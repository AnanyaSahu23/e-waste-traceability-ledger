const prisma = require("../utils/prisma");
const { createEventWithLedger } = require("../utils/ledger");

const uuidPattern =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const isUuid = (value) =>
  typeof value === "string" && uuidPattern.test(value);

const transferDetails = {
  include: {
    device: {
      select: { id: true, brand: true, model: true, currentStatus: true },
    },
    fromOrganization: { select: { id: true, name: true, type: true } },
    toOrganization: { select: { id: true, name: true, type: true } },
    initiatedEvent: true,
    acceptedEvent: true,
  },
};

const requestCustodyTransfer = async (req, res) => {
  try {
    const { deviceId, toOrganizationId, remarks } = req.body || {};

    if (!isUuid(deviceId) || !isUuid(toOrganizationId)) {
      return res.status(400).json({
        message: "Valid deviceId and toOrganizationId are required",
      });
    }
    if (remarks !== undefined && typeof remarks !== "string") {
      return res.status(400).json({ message: "remarks must be a string" });
    }

    const actor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        organizationId: true,
        organization: { select: { id: true } },
      },
    });

    if (!actor?.organizationId) {
      return res.status(403).json({
        message: "An organization membership is required to transfer custody",
      });
    }
    if (actor.organizationId === toOrganizationId) {
      return res.status(400).json({
        message: "The receiving organization must differ from the sender",
      });
    }

    const [device, destination] = await Promise.all([
      prisma.device.findUnique({
        where: { id: deviceId },
        select: {
          id: true,
          ownerId: true,
          currentStatus: true,
          events: {
            take: 1,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              organizationId: true,
              toOrganizationId: true,
            },
          },
        },
      }),
      prisma.organization.findUnique({
        where: { id: toOrganizationId },
        select: { id: true },
      }),
    ]);

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }
    if (!destination) {
      return res.status(404).json({
        message: "Receiving organization not found",
      });
    }

    const lastEvent = device.events[0];
    const currentCustodianId =
      lastEvent?.toOrganizationId || lastEvent?.organizationId;
    if (
      currentCustodianId &&
      currentCustodianId !== actor.organizationId
    ) {
      return res.status(403).json({
        message: "Your organization is not the device's current custodian",
      });
    }
    if (!currentCustodianId && device.ownerId !== req.user.id) {
      return res.status(403).json({
        message: "Only the device owner can initiate its first transfer",
      });
    }

    if (
      ["IN_TRANSIT", "DISPOSED", "COMPLETED"].includes(device.currentStatus)
    ) {
      return res.status(409).json({
        message: `A device with status ${device.currentStatus} cannot be transferred`,
      });
    }

    const transfer = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${deviceId}))::text AS lock_result
      `;
      const activeTransfer = await tx.custodyTransfer.findFirst({
        where: { deviceId, status: "PENDING" },
        select: { id: true },
      });
      if (activeTransfer) {
        return { conflict: true };
      }

      const updated = await tx.device.updateMany({
        where: { id: deviceId, currentStatus: device.currentStatus },
        data: { currentStatus: "IN_TRANSIT" },
      });
      if (updated.count === 0) {
        return { conflict: true };
      }

      const { event } = await createEventWithLedger(tx, {
        deviceId,
        eventType: "IN_TRANSIT",
        performedBy: req.user.id,
        organizationId: actor.organizationId,
        fromOrganizationId: actor.organizationId,
        toOrganizationId,
        remarks: typeof remarks === "string" ? remarks.trim() || null : null,
      });

      const created = await tx.custodyTransfer.create({
        data: {
          deviceId,
          fromOrganizationId: actor.organizationId,
          toOrganizationId,
          requestedBy: req.user.id,
          initiatedEventId: event.id,
        },
        ...transferDetails,
      });

      return { transfer: created };
    });

    if (transfer.conflict) {
      return res.status(409).json({
        message:
          "A transfer is already pending or the device status changed; reload and retry",
      });
    }

    return res.status(201).json({
      message: "Custody transfer requested successfully",
      transfer: transfer.transfer,
    });
  } catch (error) {
    console.error("Request custody transfer error:", error);
    return res.status(500).json({
      message: "Failed to request custody transfer",
    });
  }
};

const acceptCustodyTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(400).json({ message: "Invalid transfer ID" });
    }

    const actor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { organizationId: true },
    });
    if (!actor?.organizationId) {
      return res.status(403).json({
        message: "An organization membership is required to accept custody",
      });
    }

    const transfer = await prisma.custodyTransfer.findUnique({
      where: { id },
      ...transferDetails,
    });
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }
    if (transfer.toOrganizationId !== actor.organizationId) {
      return res.status(403).json({
        message: "Only the receiving organization can accept this transfer",
      });
    }
    if (transfer.status !== "PENDING") {
      return res.status(409).json({
        message: `Transfer has already been ${transfer.status.toLowerCase()}`,
      });
    }

    const accepted = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${transfer.deviceId}))::text AS lock_result
      `;

      const current = await tx.custodyTransfer.findUnique({
        where: { id },
        select: { status: true },
      });
      if (current?.status !== "PENDING") {
        return null;
      }

      const updatedDevice = await tx.device.updateMany({
        where: {
          id: transfer.deviceId,
          currentStatus: "IN_TRANSIT",
        },
        data: { currentStatus: "RECEIVED" },
      });
      if (updatedDevice.count === 0) {
        return null;
      }

      const { event } = await createEventWithLedger(tx, {
        deviceId: transfer.deviceId,
        eventType: "RECEIVED",
        performedBy: req.user.id,
        organizationId: transfer.toOrganizationId,
        fromOrganizationId: transfer.fromOrganizationId,
        toOrganizationId: transfer.toOrganizationId,
        remarks: "Custody transfer accepted",
      });

      const updatedTransfer = await tx.custodyTransfer.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          acceptedEventId: event.id,
        },
      });
      if (updatedTransfer.count === 0) {
        const error = new Error("Transfer changed while being accepted");
        error.code = "TRANSFER_CONFLICT";
        throw error;
      }

      return tx.custodyTransfer.findUnique({
        where: { id },
        ...transferDetails,
      });
    });

    if (!accepted) {
      return res.status(409).json({
        message:
          "Transfer is no longer pending or the device is not in transit",
      });
    }

    return res.status(200).json({
      message: "Custody transfer accepted successfully",
      transfer: accepted,
    });
  } catch (error) {
    if (error.code === "TRANSFER_CONFLICT") {
      return res.status(409).json({
        message: "Transfer is no longer pending; reload and retry",
      });
    }

    console.error("Accept custody transfer error:", error);
    return res.status(500).json({
      message: "Failed to accept custody transfer",
    });
  }
};

module.exports = {
  requestCustodyTransfer,
  acceptCustodyTransfer,
};
