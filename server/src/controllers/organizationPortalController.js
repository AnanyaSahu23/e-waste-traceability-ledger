const prisma = require("../utils/prisma");
const { createEventWithLedger, verifyDeviceLedger } = require("../utils/ledger");

const requestStatuses = new Set([
  "PENDING",
  "ACCEPTED",
  "SCHEDULED",
  "COLLECTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
]);
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const parseDateFilter = (value, endOfDay = false) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = new Date(
    dateOnly ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z` : value
  );
  if (dateOnly && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const organizationUser = async (userId) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true,
      organization: {
        select: {
          id: true,
          name: true,
          type: true,
          licenseNumber: true,
          contactEmail: true,
        },
      },
    },
  });

const requireOrganization = async (req, res, allowedTypes = null) => {
  const user = await organizationUser(req.user.id);
  if (!user?.organizationId || !user.organization) {
    res.status(403).json({ message: "An organization account is required" });
    return null;
  }
  if (allowedTypes && !allowedTypes.includes(user.organization.type)) {
    res.status(403).json({
      message: `This action is not available to ${user.organization.type.toLowerCase().replaceAll("_", " ")} organizations`,
    });
    return null;
  }
  return user;
};

const requestInclude = {
  device: {
    select: {
      id: true,
      brand: true,
      model: true,
      serialNumber: true,
      manufactureYear: true,
      currentStatus: true,
      category: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  },
  pickupRequest: true,
};

const getProfile = async (req, res) => {
  try {
    const user = await requireOrganization(req, res);
    if (!user) return;
    return res.status(200).json({
      organization: user.organization,
      member: { id: user.id },
    });
  } catch (error) {
    console.error("Get organization portal profile error:", error);
    return res.status(500).json({ message: "Failed to load organization profile" });
  }
};

const getIncomingRequests = async (req, res) => {
  try {
    const user = await requireOrganization(req, res);
    if (!user) return;
    const { status, categoryId, from, to } = req.query;
    const where = { organizationId: user.organizationId };
    if (typeof status === "string" && status !== "ALL") {
      const normalizedStatus = status.toUpperCase();
      if (!requestStatuses.has(normalizedStatus)) {
        return res.status(400).json({ message: "Invalid request status filter" });
      }
      where.status = normalizedStatus;
    }
    if (typeof categoryId === "string") {
      if (!uuidPattern.test(categoryId)) {
        return res.status(400).json({ message: "Invalid device category filter" });
      }
      where.device = { categoryId };
    }
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const parsedFrom = parseDateFilter(from);
        if (!parsedFrom) return res.status(400).json({ message: "Invalid from date" });
        where.createdAt.gte = parsedFrom;
      }
      if (to) {
        const parsedTo = parseDateFilter(to, true);
        if (!parsedTo) return res.status(400).json({ message: "Invalid to date" });
        where.createdAt.lte = parsedTo;
      }
      if (where.createdAt.gte && where.createdAt.lte > where.createdAt.gte) {
        return res.status(400).json({ message: "The to date must not precede the from date" });
      }
    }
    const requests = await prisma.recyclingRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ requests });
  } catch (error) {
    console.error("Get organization requests error:", error);
    return res.status(500).json({ message: "Failed to load organization requests" });
  }
};

const getOrganizationDevice = async (req, res) => {
  const user = await requireOrganization(req, res);
  if (!user) return null;
  const { id } = req.params;
  if (!uuidPattern.test(id)) {
    res.status(400).json({ message: "Invalid device ID" });
    return null;
  }
  const device = await prisma.device.findFirst({
    where: {
      id,
      OR: [
        {
          events: {
            some: {
              OR: [
                { organizationId: user.organizationId },
                { fromOrganizationId: user.organizationId },
                { toOrganizationId: user.organizationId },
              ],
            },
          },
        },
        { recyclingRequests: { some: { organizationId: user.organizationId } } },
      ],
    },
    select: {
      id: true,
      brand: true,
      model: true,
      currentStatus: true,
      category: { select: { id: true, name: true } },
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          eventType: true,
          createdAt: true,
          performedBy: true,
          remarks: true,
          organization: { select: { id: true, name: true, type: true } },
          fromOrganization: { select: { id: true, name: true, type: true } },
          toOrganization: { select: { id: true, name: true, type: true } },
          ledgerEntry: {
            select: {
              id: true,
              currentHash: true,
              previousHash: true,
              previousLedgerId: true,
            },
          },
          recoveryOperation: {
            select: {
              id: true,
              recoveredAt: true,
              remarks: true,
              materials: {
                include: { material: { select: { name: true } } },
                orderBy: { createdAt: "asc" },
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
    res.status(404).json({ message: "Device lifecycle not found for this organization" });
    return null;
  }
  return { user, device };
};

const getOrganizationDeviceTracking = async (req, res) => {
  try {
    const accessible = await getOrganizationDevice(req, res);
    if (!accessible) return;
    const { device } = accessible;
    const ledgerVerification = await verifyDeviceLedger(prisma, device.id);
    return res.status(200).json({
      message: "Device tracking history retrieved successfully",
      device: {
        id: device.id,
        brand: device.brand,
        model: device.model,
        currentStatus: device.currentStatus,
        category: device.category,
      },
      timeline: device.events.map((event) => ({
        eventId: event.id,
        eventType: event.eventType,
        timestamp: event.createdAt,
        performedBy: event.performedBy,
        organization: event.organization,
        fromOrganization: event.fromOrganization,
        toOrganization: event.toOrganization,
        remarks: event.remarks,
        recovery: event.recoveryOperation
          ? {
              id: event.recoveryOperation.id,
              recoveredAt: event.recoveryOperation.recoveredAt,
              remarks: event.recoveryOperation.remarks,
              materials: event.recoveryOperation.materials.map((item) => ({
                materialType: item.material.name,
                quantity: Number(item.quantity),
                unit: item.unit,
                condition: item.condition,
              })),
            }
          : null,
        disposal: event.disposalRecord
          ? {
              wasteDescription: event.disposalRecord.wasteDescription,
              disposalMethod: event.disposalRecord.disposalMethod,
              quantity: event.disposalRecord.quantity === null
                ? null
                : Number(event.disposalRecord.quantity),
              unit: event.disposalRecord.unit,
              facilityName: event.disposalRecord.facilityName,
              hazardous: event.disposalRecord.hazardous,
              disposalDate: event.disposalRecord.disposalDate,
            }
          : null,
        ledger: event.ledgerEntry
          ? {
              entryId: event.ledgerEntry.id,
              currentHash: event.ledgerEntry.currentHash,
              previousHash: event.ledgerEntry.previousHash,
              previousLedgerId: event.ledgerEntry.previousLedgerId,
            }
          : null,
      })),
      ledgerVerification,
    });
  } catch (error) {
    console.error("Get organization device tracking error:", error);
    return res.status(500).json({ message: "Failed to retrieve organization device lifecycle" });
  }
};

const verifyOrganizationDevice = async (req, res) => {
  try {
    const accessible = await getOrganizationDevice(req, res);
    if (!accessible) return;
    const { user, device } = accessible;
    const verification = await verifyDeviceLedger(prisma, device.id);
    await prisma.verification.create({
      data: {
        deviceId: device.id,
        verifiedBy: user.id,
        result: verification.valid ? "VALID" : "INVALID",
        brokenRecord: verification.errors.length ? verification.errors.join("\n") : null,
      },
    });
    return res.status(200).json({
      message: verification.valid
        ? "Lifecycle ledger verified successfully"
        : "Lifecycle ledger verification failed",
      ...verification,
    });
  } catch (error) {
    console.error("Verify organization device ledger error:", error);
    return res.status(500).json({ message: "Failed to verify organization device ledger" });
  }
};

const decideRequest = async (req, res) => {
  try {
    const user = await requireOrganization(req, res, ["COLLECTION_CENTER"]);
    if (!user) return;
    const { id } = req.params;
    const { decision } = req.body || {};
    if (!["ACCEPTED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ message: "decision must be ACCEPTED or REJECTED" });
    }
    const request = await prisma.recyclingRequest.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { pickupRequest: true },
    });
    if (!request) {
      return res.status(404).json({ message: "Incoming recycling request not found" });
    }
    if (request.status !== "PENDING") {
      return res.status(409).json({
        message: `A request with status ${request.status} cannot be decided`,
      });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.recyclingRequest.updateMany({
        where: { id, organizationId: user.organizationId, status: "PENDING" },
        data: { status: decision },
      });
      if (!changed.count) return null;
      if (request.pickupRequest) {
        await tx.pickupRequest.update({
          where: { recyclingRequestId: id },
          data: { status: decision },
        });
      }
      return tx.recyclingRequest.findUnique({
        where: { id },
        include: requestInclude,
      });
    });
    if (!updated) {
      return res.status(409).json({ message: "Request was changed; refresh and retry" });
    }
    return res.status(200).json({ message: `Request ${decision.toLowerCase()}`, request: updated });
  } catch (error) {
    console.error("Decide organization request error:", error);
    return res.status(500).json({ message: "Failed to update recycling request" });
  }
};

const getInventory = async (req, res) => {
  try {
    const user = await requireOrganization(req, res);
    if (!user) return;
    const devices = await prisma.device.findMany({
      where: {
        events: {
          some: {
            OR: [
              { organizationId: user.organizationId },
              { fromOrganizationId: user.organizationId },
              { toOrganizationId: user.organizationId },
            ],
          },
        },
      },
      select: {
        id: true,
        brand: true,
        model: true,
        currentStatus: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
        events: {
          take: 1,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            organizationId: true,
            fromOrganizationId: true,
            toOrganizationId: true,
            createdAt: true,
            eventType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const inCustody = devices.filter((device) => {
      const latest = device.events[0];
      return device.currentStatus !== "IN_TRANSIT" &&
        (latest?.toOrganizationId || latest?.organizationId) === user.organizationId;
    });
    return res.status(200).json({ devices: inCustody });
  } catch (error) {
    console.error("Get organization inventory error:", error);
    return res.status(500).json({ message: "Failed to load organization inventory" });
  }
};

const getTransfers = async (req, res) => {
  try {
    const user = await requireOrganization(req, res);
    if (!user) return;
    const transfers = await prisma.custodyTransfer.findMany({
      where: {
        OR: [
          { fromOrganizationId: user.organizationId },
          { toOrganizationId: user.organizationId },
        ],
      },
      include: {
        device: {
          select: { id: true, brand: true, model: true, currentStatus: true },
        },
        fromOrganization: { select: { id: true, name: true } },
        toOrganization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const organizations = await prisma.organization.findMany({
      where: { id: { not: user.organizationId } },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ transfers, organizations });
  } catch (error) {
    console.error("Get organization transfers error:", error);
    return res.status(500).json({ message: "Failed to load custody transfers" });
  }
};

const receiveRequest = async (req, res) => {
  try {
    const user = await requireOrganization(req, res, ["COLLECTION_CENTER"]);
    if (!user) return;
    const { id } = req.params;
    const request = await prisma.recyclingRequest.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        status: "ACCEPTED",
      },
      include: {
        device: { select: { id: true, currentStatus: true } },
        pickupRequest: true,
      },
    });
    if (!request) {
      return res.status(404).json({ message: "Accepted incoming request not found" });
    }
    if (!["REGISTERED", "AWAITING_COLLECTION"].includes(request.device.currentStatus)) {
      return res.status(409).json({
        message: `Device cannot be received while status is ${request.device.currentStatus}`,
      });
    }
    const received = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${request.deviceId}))::text AS lock_result
      `;
      const changed = await tx.device.updateMany({
        where: {
          id: request.deviceId,
          currentStatus: request.device.currentStatus,
        },
        data: { currentStatus: "RECEIVED" },
      });
      if (!changed.count) return null;
      await createEventWithLedger(tx, {
        deviceId: request.deviceId,
        eventType: "RECEIVED",
        performedBy: user.id,
        organizationId: user.organizationId,
        toOrganizationId: user.organizationId,
        remarks: "Physical handover received by collection center",
      });
      await tx.recyclingRequest.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });
      if (request.pickupRequest) {
        await tx.pickupRequest.update({
          where: { recyclingRequestId: id },
          data: { status: "COMPLETED" },
        });
      }
      return tx.device.findUnique({
        where: { id: request.deviceId },
        select: { id: true, currentStatus: true },
      });
    });
    if (!received) {
      return res.status(409).json({ message: "Device state changed; refresh and retry" });
    }
    return res.status(200).json({
      message: "Physical receipt recorded",
      device: received,
    });
  } catch (error) {
    console.error("Record physical device receipt error:", error);
    return res.status(500).json({ message: "Failed to record device receipt" });
  }
};

const getDashboard = async (req, res) => {
  try {
    const user = await requireOrganization(req, res);
    if (!user) return;
    const [requests, devices, recoveries, disposals, recentEvents] = await Promise.all([
      prisma.recyclingRequest.groupBy({
        by: ["status"],
        where: { organizationId: user.organizationId },
        _count: { _all: true },
      }),
      prisma.device.findMany({
        where: {
          events: {
            some: {
              OR: [
                { organizationId: user.organizationId },
                { fromOrganizationId: user.organizationId },
                { toOrganizationId: user.organizationId },
              ],
            },
          },
        },
        select: {
          id: true,
          brand: true,
          model: true,
          currentStatus: true,
          createdAt: true,
          events: {
            take: 1,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: { organizationId: true, toOrganizationId: true },
          },
        },
      }),
      prisma.materialRecoveryOperation.count({
        where: { organizationId: user.organizationId },
      }),
      prisma.disposalRecord.count({
        where: { organizationId: user.organizationId },
      }),
      prisma.event.findMany({
        where: { organizationId: user.organizationId },
        take: 8,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          eventType: true,
          createdAt: true,
          device: { select: { id: true, brand: true, model: true } },
        },
      }),
    ]);
    const custody = devices.filter((device) => {
      const latest = device.events[0];
      return device.currentStatus !== "IN_TRANSIT" &&
        (latest?.toOrganizationId || latest?.organizationId) === user.organizationId;
    });
    const requestCounts = Object.fromEntries(
      requests.map((item) => [item.status, item._count._all])
    );
    return res.status(200).json({
      organization: user.organization,
      metrics: {
        pendingRequests: requestCounts.PENDING || 0,
        acceptedRequests: requestCounts.ACCEPTED || 0,
        devicesInCustody: custody.length,
        recoveryOperations: recoveries,
        disposalRecords: disposals,
        completedDevices: custody.filter((device) => device.currentStatus === "COMPLETED").length,
      },
      lifecycleStages: custody.reduce((counts, device) => {
        counts[device.currentStatus] = (counts[device.currentStatus] || 0) + 1;
        return counts;
      }, {}),
      recentActivity: recentEvents,
      pendingRequests: await prisma.recyclingRequest.findMany({
        where: { organizationId: user.organizationId, status: "PENDING" },
        take: 5,
        include: requestInclude,
        orderBy: { createdAt: "desc" },
      }),
    });
  } catch (error) {
    console.error("Get organization dashboard error:", error);
    return res.status(500).json({ message: "Failed to load organization dashboard" });
  }
};

module.exports = {
  getProfile,
  getIncomingRequests,
  decideRequest,
  getInventory,
  getTransfers,
  receiveRequest,
  getDashboard,
  getOrganizationDeviceTracking,
  verifyOrganizationDevice,
};
