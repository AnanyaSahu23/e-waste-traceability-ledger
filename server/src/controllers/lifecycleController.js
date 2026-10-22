const prisma = require("../utils/prisma");
const { createEventWithLedger, verifyDeviceLedger } = require("../utils/ledger");

const uuidPattern =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const isUuid = (value) =>
  typeof value === "string" && uuidPattern.test(value);

const getDeviceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(400).json({ message: "Invalid device ID" });
    }

    const device = await prisma.device.findUnique({
      where: { id },
      select: {
        id: true,
        brand: true,
        model: true,
        currentStatus: true,
        events: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            organization: { select: { id: true, name: true, type: true } },
            fromOrganization: { select: { id: true, name: true, type: true } },
            toOrganization: { select: { id: true, name: true, type: true } },
            performer: { select: { id: true, name: true } },
            ledgerEntry: true,
            recoveryOperation: {
              select: {
                id: true,
                recoveredAt: true,
                remarks: true,
                materials: {
                  include: {
                    material: { select: { id: true, name: true } },
                  },
                },
              },
            },
            disposalRecord: {
              select: {
                wasteDescription: true,
                disposalMethod: true,
                quantity: true,
                unit: true,
                facilityName: true,
                hazardous: true,
                disposalDate: true,
              },
            },
          },
        },
      },
    });

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    return res.status(200).json({
      device: {
        id: device.id,
        brand: device.brand,
        model: device.model,
        currentStatus: device.currentStatus,
      },
      timeline: device.events,
    });
  } catch (error) {
    console.error("Get device lifecycle history error:", error);
    return res.status(500).json({
      message: "Failed to retrieve device lifecycle history",
    });
  }
};

const processTransitions = {
  INSPECTED: {
    from: ["RECEIVED"],
    to: "UNDER_INSPECTION",
  },
  COMPLETED: {
    from: ["MATERIAL_RECOVERY", "DISPOSED"],
    to: "COMPLETED",
  },
};

const recordDeviceProcess = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventType, remarks } = req.body || {};

    if (!isUuid(id)) {
      return res.status(400).json({ message: "Invalid device ID" });
    }

    const transition =
      typeof eventType === "string" &&
      Object.hasOwn(processTransitions, eventType)
      ? processTransitions[eventType]
      : null;
    if (!transition) {
      return res.status(400).json({
        message:
          "eventType must be INSPECTED or COMPLETED. Use the dedicated material-recovery and disposal endpoints for processing records.",
      });
    }

    if (remarks !== undefined && typeof remarks !== "string") {
      return res.status(400).json({ message: "remarks must be a string" });
    }

    const actor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        organizationId: true,
        organization: { select: { type: true } },
      },
    });

    if (!actor?.organizationId) {
      return res.status(403).json({
        message: "An organization membership is required to record processing",
      });
    }

    if (actor.organization?.type !== "RECYCLING_FACILITY") {
      return res.status(403).json({
        message: "Only a recycling facility can record processing events",
      });
    }

    const device = await prisma.device.findUnique({
      where: { id },
      select: {
        id: true,
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
    });

    if (!device) {
      return res.status(404).json({ message: "Device not found" });
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

    if (!transition.from.includes(device.currentStatus)) {
      return res.status(409).json({
        message: `Cannot record ${eventType} while device status is ${device.currentStatus}`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${id}))::text AS lock_result
      `;
      const updated = await tx.device.updateMany({
        where: { id, currentStatus: device.currentStatus },
        data: { currentStatus: transition.to },
      });

      if (updated.count === 0) {
        return null;
      }

      const { event, ledgerEntry } = await createEventWithLedger(tx, {
        deviceId: id,
        eventType,
        performedBy: req.user.id,
        organizationId: actor.organizationId,
        remarks: typeof remarks === "string" ? remarks.trim() || null : null,
      });

      return { event, ledgerEntry };
    });

    if (!result) {
      return res.status(409).json({
        message: "The device status changed; reload its lifecycle and retry",
      });
    }

    return res.status(201).json({
      message: `${eventType} event recorded successfully`,
      event: result.event,
      ledger: result.ledgerEntry,
      currentStatus: transition.to,
    });
  } catch (error) {
    console.error("Record device processing error:", error);
    return res.status(500).json({
      message: "Failed to record device processing",
    });
  }
};

const verifyDeviceLifecycle = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(400).json({ message: "Invalid device ID" });
    }

    const verification = await verifyDeviceLedger(prisma, id);
    if (!verification.exists) {
      return res.status(404).json({
        message: "Device not found",
        ...verification,
      });
    }

    await prisma.verification.create({
      data: {
        deviceId: id,
        verifiedBy: req.user.id,
        result: verification.valid ? "VALID" : "INVALID",
        brokenRecord: verification.errors.length
          ? verification.errors.join("\n")
          : null,
      },
    });

    return res.status(200).json({
      message: verification.valid
        ? "Lifecycle ledger verified successfully"
        : "Lifecycle ledger verification failed",
      ...verification,
    });
  } catch (error) {
    console.error("Verify device lifecycle error:", error);
    return res.status(500).json({
      message: "Failed to verify device lifecycle ledger",
    });
  }
};

module.exports = {
  getDeviceHistory,
  recordDeviceProcess,
  verifyDeviceLifecycle,
};
