const crypto = require("crypto");
const prisma = require("../utils/prisma");
const { createEventWithLedger } = require("../utils/ledger");

const uuidPattern =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const supportedUnits = new Set(["kg", "g", "pieces", "litres"]);
const materialConditions = new Set(["REUSABLE", "RECYCLABLE", "OTHER"]);
const disposalMethods = new Set([
  "AUTHORIZED_TREATMENT",
  "RECYCLING",
  "LANDFILL",
  "INCINERATION",
  "OTHER",
]);

const isUuid = (value) =>
  typeof value === "string" && uuidPattern.test(value);

const quantityIsValid = (value) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 9999999.999 &&
  Math.abs(value * 1000 - Math.round(value * 1000)) <= 1e-8;

const requestFingerprint = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

const isIdempotencyUniqueConflict = (error) =>
  error?.code === "P2002" &&
  String(error.meta?.target || "").includes("idempotencyKey");

const sortedMaterials = (materials) =>
  [...materials].sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  );

const getActor = async (userId) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true,
      organization: { select: { type: true } },
    },
  });

const authorizeDeviceCustody = async (tx, deviceId, actor) => {
  const device = await tx.device.findUnique({
    where: { id: deviceId },
    select: {
      id: true,
      currentStatus: true,
      events: {
        take: 1,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { organizationId: true, toOrganizationId: true },
      },
    },
  });

  if (!device) {
    return { error: { status: 404, message: "Device not found" } };
  }

  const lastEvent = device.events[0];
  const currentCustodianId =
    lastEvent?.toOrganizationId || lastEvent?.organizationId;
  if (currentCustodianId !== actor.organizationId) {
    return {
      error: {
        status: 403,
        message: "Your organization is not the device's current custodian",
      },
    };
  }

  return { device };
};

const checkActor = async (req, res) => {
  const actor = await getActor(req.user.id);
  if (!actor?.organizationId) {
    res.status(403).json({
      message: "An organization membership is required to record processing",
    });
    return null;
  }
  if (actor.organization?.type !== "RECYCLING_FACILITY") {
    res.status(403).json({
      message: "Only a recycling facility can record processing events",
    });
    return null;
  }
  return actor;
};

const readIdempotencyKey = (req, res) => {
  const key = req.get("Idempotency-Key");
  if (!isUuid(key)) {
    res.status(400).json({
      message: "A UUID Idempotency-Key header is required",
    });
    return null;
  }
  return key.toLowerCase();
};

const findReplay = async (tx, modelName, key, fingerprint) => {
  const previous = await tx[modelName].findUnique({
    where: { idempotencyKey: key },
    include: {
      event: {
        select: {
          id: true,
          eventType: true,
          createdAt: true,
          ledgerEntry: {
            select: {
              id: true,
              currentHash: true,
              previousHash: true,
              previousLedgerId: true,
            },
          },
        },
      },
      ...(modelName === "materialRecoveryOperation"
        ? {
            materials: {
              include: { material: { select: { id: true, name: true } } },
            },
          }
        : {}),
    },
  });
  if (!previous) return null;
  if (previous.requestHash !== fingerprint) {
    return { conflict: true };
  }
  return { previous };
};

const recordMaterialRecovery = async (req, res) => {
  try {
    const { id: deviceId } = req.params;
    if (!isUuid(deviceId)) {
      return res.status(400).json({ message: "Invalid device ID" });
    }

    const idempotencyKey = readIdempotencyKey(req, res);
    if (!idempotencyKey) return;

    const { remarks, materials } = req.body || {};
    if (
      remarks !== undefined &&
      (typeof remarks !== "string" || remarks.length > 2000)
    ) {
      return res.status(400).json({
        message: "remarks must be a string of at most 2000 characters",
      });
    }
    if (!Array.isArray(materials) || materials.length === 0 || materials.length > 50) {
      return res.status(400).json({
        message: "Provide between 1 and 50 recovered materials",
      });
    }

    const normalizedMaterials = materials.map((material) => ({
      materialType:
        typeof material?.materialType === "string"
          ? material.materialType.trim()
          : "",
      quantity: material?.quantity,
      unit: typeof material?.unit === "string" ? material.unit.trim() : "",
      condition:
        typeof material?.condition === "string"
          ? material.condition.trim().toUpperCase()
          : "",
    }));
    if (
      normalizedMaterials.some(
        ({ materialType, quantity, unit, condition }) =>
          !materialType ||
          materialType.length > 100 ||
          !quantityIsValid(quantity) ||
          !supportedUnits.has(unit) ||
          !materialConditions.has(condition)
      )
    ) {
      return res.status(400).json({
        message:
          "Each material needs a name, positive quantity (up to 3 decimals), supported unit (kg, g, pieces, litres), and condition (REUSABLE, RECYCLABLE, OTHER)",
      });
    }

    const actor = await checkActor(req, res);
    if (!actor) return;
    const normalizedRemarks =
      typeof remarks === "string" ? remarks.trim() || null : null;
    const fingerprint = requestFingerprint({
      deviceId,
      organizationId: actor.organizationId,
      performedBy: actor.id,
      remarks: normalizedRemarks,
      materials: sortedMaterials(normalizedMaterials),
    });

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${deviceId}))::text AS lock_result
      `;
      const replay = await findReplay(
        tx,
        "materialRecoveryOperation",
        idempotencyKey,
        fingerprint
      );
      if (replay) return replay;

      const { device, error } = await authorizeDeviceCustody(
        tx,
        deviceId,
        actor
      );
      if (error) return { error };
      if (!["UNDER_INSPECTION", "MATERIAL_RECOVERY"].includes(device.currentStatus)) {
        return {
          error: {
            status: 409,
            message: `Cannot record material recovery while device status is ${device.currentStatus}`,
          },
        };
      }

      const { event, ledgerEntry, details } = await createEventWithLedger(
        tx,
        {
          deviceId,
          eventType: "MATERIAL_RECOVERY",
          performedBy: actor.id,
          organizationId: actor.organizationId,
          remarks: normalizedRemarks,
        },
        {
          createDetails: async (transaction, createdEvent) => {
            const recovery = await transaction.materialRecoveryOperation.create({
              data: {
                eventId: createdEvent.id,
                deviceId,
                organizationId: actor.organizationId,
                performedBy: actor.id,
                idempotencyKey,
                requestHash: fingerprint,
                recoveredAt: createdEvent.createdAt,
                remarks: normalizedRemarks,
                materials: {
                  create: await Promise.all(
                    normalizedMaterials.map(async (item) => {
                      const material = await transaction.material.upsert({
                        where: { name: item.materialType },
                        update: {},
                        create: { name: item.materialType },
                      });
                      return {
                        eventId: createdEvent.id,
                        materialId: material.id,
                        quantity: item.quantity,
                        unit: item.unit,
                        condition: item.condition,
                      };
                    })
                  ),
                },
              },
            });

            if (device.currentStatus === "UNDER_INSPECTION") {
              await transaction.device.update({
                where: { id: deviceId },
                data: { currentStatus: "MATERIAL_RECOVERY" },
              });
            }
            return {
              recovery: {
                id: recovery.id,
                deviceId,
                organizationId: actor.organizationId,
                performedBy: actor.id,
                recoveredAt: createdEvent.createdAt.toISOString(),
                remarks: normalizedRemarks,
              },
              materials: sortedMaterials(normalizedMaterials),
            };
          },
        }
      );
      return {
        event,
        ledgerEntry,
        recoveryId: details.recovery.id,
        replayed: false,
      };
    });

    if (result.conflict) {
      return res.status(409).json({
        message: "Idempotency-Key was already used with a different request",
      });
    }
    if (result.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }
    if (result.previous) {
      return res.status(200).json({
        message: "Material recovery was already recorded",
        recovery: {
          id: result.previous.id,
          recoveredAt: result.previous.recoveredAt,
          remarks: result.previous.remarks,
          materials: result.previous.materials.map((material) => ({
            ...material,
            quantity: Number(material.quantity),
          })),
          event: result.previous.event,
        },
        replayed: true,
      });
    }

    return res.status(201).json({
      message: "Material recovery recorded successfully",
      recoveryId: result.recoveryId,
      event: result.event,
      ledger: result.ledgerEntry,
      currentStatus: "MATERIAL_RECOVERY",
      replayed: false,
    });
  } catch (error) {
    if (isIdempotencyUniqueConflict(error)) {
      return res.status(409).json({
        message: "Idempotency-Key was already used for another request",
      });
    }
    console.error("Record material recovery error:", error);
    return res.status(500).json({
      message: "Failed to record material recovery",
    });
  }
};

const recoverySelect = {
  id: true,
  deviceId: true,
  organizationId: true,
  performedBy: true,
  recoveredAt: true,
  remarks: true,
  event: {
    select: {
      id: true,
      eventType: true,
      createdAt: true,
      ledgerEntry: {
        select: {
          id: true,
          currentHash: true,
          previousHash: true,
          previousLedgerId: true,
        },
      },
    },
  },
  device: { select: { id: true, brand: true, model: true } },
  organization: { select: { id: true, name: true } },
  performer: { select: { id: true, name: true } },
  materials: {
    select: {
      id: true,
      quantity: true,
      unit: true,
      condition: true,
      material: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
};

const serializeRecovery = (recovery) => ({
  ...recovery,
  materials: recovery.materials.map((material) => ({
    ...material,
    quantity: Number(material.quantity),
  })),
});

const getMaterialRecoveries = async (req, res) => {
  try {
    const { id: deviceId } = req.params;
    if (!isUuid(deviceId)) {
      return res.status(400).json({ message: "Invalid device ID" });
    }
    const deviceExists = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!deviceExists) {
      return res.status(404).json({ message: "Device not found" });
    }
    const recoveries = await prisma.materialRecoveryOperation.findMany({
      where: { deviceId },
      select: recoverySelect,
      orderBy: [{ recoveredAt: "asc" }, { id: "asc" }],
    });
    return res.status(200).json({
      recoveries: recoveries.map(serializeRecovery),
    });
  } catch (error) {
    console.error("Get device material recoveries error:", error);
    return res.status(500).json({
      message: "Failed to retrieve material recovery history",
    });
  }
};

const getMaterialRecovery = async (req, res) => {
  try {
    const { recoveryId } = req.params;
    if (!isUuid(recoveryId)) {
      return res.status(400).json({ message: "Invalid recovery ID" });
    }
    const recovery = await prisma.materialRecoveryOperation.findUnique({
      where: { id: recoveryId },
      select: recoverySelect,
    });
    if (!recovery) {
      return res.status(404).json({ message: "Material recovery not found" });
    }
    return res.status(200).json({ recovery: serializeRecovery(recovery) });
  } catch (error) {
    console.error("Get material recovery error:", error);
    return res.status(500).json({
      message: "Failed to retrieve material recovery",
    });
  }
};

const recordDisposal = async (req, res) => {
  try {
    const { id: deviceId } = req.params;
    if (!isUuid(deviceId)) {
      return res.status(400).json({ message: "Invalid device ID" });
    }

    const idempotencyKey = readIdempotencyKey(req, res);
    if (!idempotencyKey) return;
    const {
      wasteDescription,
      disposalMethod,
      quantity,
      unit,
      facilityName,
      hazardous,
      disposalDate,
      remarks,
    } = req.body || {};

    const normalizedMethod =
      typeof disposalMethod === "string"
        ? disposalMethod.trim().toUpperCase()
        : "";
    const normalizedUnit = typeof unit === "string" ? unit.trim() : "";
    const normalizedFacility =
      typeof facilityName === "string" ? facilityName.trim() : "";
    const normalizedDescription =
      typeof wasteDescription === "string" ? wasteDescription.trim() : "";
    const normalizedRemarks =
      typeof remarks === "string" ? remarks.trim() || null : null;
    const normalizedDate =
      typeof disposalDate === "string" ? new Date(disposalDate) : null;

    if (!normalizedDescription || normalizedDescription.length > 500) {
      return res.status(400).json({
        message: "wasteDescription is required and must be at most 500 characters",
      });
    }
    if (!disposalMethods.has(normalizedMethod)) {
      return res.status(400).json({
        message: "disposalMethod must be a supported disposal method",
      });
    }
    if (!quantityIsValid(quantity) || !supportedUnits.has(normalizedUnit)) {
      return res.status(400).json({
        message: "quantity must be positive (up to 3 decimals) and unit must be supported",
      });
    }
    if (typeof hazardous !== "boolean") {
      return res.status(400).json({ message: "hazardous must be a boolean" });
    }
    if (
      hazardous &&
      (normalizedMethod !== "AUTHORIZED_TREATMENT" || !normalizedFacility)
    ) {
      return res.status(400).json({
        message:
          "Hazardous waste requires AUTHORIZED_TREATMENT and a receiving facility",
      });
    }
    if (normalizedFacility.length > 200) {
      return res.status(400).json({
        message: "facilityName must be at most 200 characters",
      });
    }
    if (!normalizedDate || Number.isNaN(normalizedDate.getTime())) {
      return res.status(400).json({
        message: "disposalDate must be a valid date",
      });
    }
    if (
      remarks !== undefined &&
      (typeof remarks !== "string" || remarks.length > 2000)
    ) {
      return res.status(400).json({
        message: "remarks must be a string of at most 2000 characters",
      });
    }

    const actor = await checkActor(req, res);
    if (!actor) return;
    const disposalDetails = {
      wasteDescription: normalizedDescription,
      disposalMethod: normalizedMethod,
      disposalDate: normalizedDate.toISOString(),
      quantity,
      unit: normalizedUnit,
      hazardous,
      facilityName: normalizedFacility || null,
    };
    const fingerprint = requestFingerprint({
      deviceId,
      organizationId: actor.organizationId,
      performedBy: actor.id,
      remarks: normalizedRemarks,
      disposal: disposalDetails,
    });

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${deviceId}))::text AS lock_result
      `;
      const replay = await findReplay(
        tx,
        "disposalRecord",
        idempotencyKey,
        fingerprint
      );
      if (replay) return replay;

      const { device, error } = await authorizeDeviceCustody(
        tx,
        deviceId,
        actor
      );
      if (error) return { error };
      if (!["UNDER_INSPECTION", "MATERIAL_RECOVERY"].includes(device.currentStatus)) {
        return {
          error: {
            status: 409,
            message: `Cannot record disposal while device status is ${device.currentStatus}`,
          },
        };
      }

      const { event, ledgerEntry, details } = await createEventWithLedger(
        tx,
        {
          deviceId,
          eventType: "DISPOSAL",
          performedBy: actor.id,
          organizationId: actor.organizationId,
          remarks: normalizedRemarks,
        },
        {
          createDetails: async (transaction, createdEvent) => {
            const savedDisposal = await transaction.disposalRecord.create({
              data: {
                eventId: createdEvent.id,
                deviceId,
                organizationId: actor.organizationId,
                performedBy: actor.id,
                idempotencyKey,
                requestHash: fingerprint,
                wasteDescription: normalizedDescription,
                disposalMethod: normalizedMethod,
                disposalDate: normalizedDate,
                quantity,
                unit: normalizedUnit,
                facilityName: normalizedFacility || null,
                hazardous,
              },
            });
            return {
              disposal: {
                id: savedDisposal.id,
                ...disposalDetails,
                deviceId,
                organizationId: actor.organizationId,
                performedBy: actor.id,
              },
            };
          },
        }
      );
      return {
        event,
        ledgerEntry,
        disposalId: details.disposal.id,
        currentStatus: device.currentStatus,
        replayed: false,
      };
    });

    if (result.conflict) {
      return res.status(409).json({
        message: "Idempotency-Key was already used with a different request",
      });
    }
    if (result.error) {
      return res.status(result.error.status).json({
        message: result.error.message,
      });
    }
    if (result.previous) {
      return res.status(200).json({
        message: "Disposal was already recorded",
        disposal: {
          id: result.previous.id,
          event: result.previous.event,
          wasteDescription: result.previous.wasteDescription,
          disposalMethod: result.previous.disposalMethod,
          disposalDate: result.previous.disposalDate,
          quantity: result.previous.quantity,
          unit: result.previous.unit,
          facilityName: result.previous.facilityName,
          hazardous: result.previous.hazardous,
        },
        replayed: true,
      });
    }
    return res.status(201).json({
      message: "Disposal record created successfully",
      disposalId: result.disposalId,
      event: result.event,
      ledger: result.ledgerEntry,
      currentStatus: result.currentStatus,
      replayed: false,
    });
  } catch (error) {
    if (isIdempotencyUniqueConflict(error)) {
      return res.status(409).json({
        message: "Idempotency-Key was already used for another request",
      });
    }
    console.error("Record disposal error:", error);
    return res.status(500).json({ message: "Failed to record disposal" });
  }
};

const getDeviceDisposals = async (req, res) => {
  try {
    const { id: deviceId } = req.params;
    if (!isUuid(deviceId)) {
      return res.status(400).json({ message: "Invalid device ID" });
    }
    const deviceExists = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!deviceExists) {
      return res.status(404).json({ message: "Device not found" });
    }
    const disposals = await prisma.disposalRecord.findMany({
      where: { deviceId },
      select: {
        id: true,
        eventId: true,
        deviceId: true,
        organizationId: true,
        performedBy: true,
        wasteDescription: true,
        disposalMethod: true,
        quantity: true,
        unit: true,
        facilityName: true,
        hazardous: true,
        disposalDate: true,
        event: { include: { ledgerEntry: true } },
        organization: { select: { id: true, name: true } },
        performer: { select: { id: true, name: true } },
      },
      orderBy: [{ disposalDate: "asc" }, { id: "asc" }],
    });
    return res.status(200).json({
      disposals: disposals.map((disposal) => ({
        ...disposal,
        quantity:
          disposal.quantity === null ? null : Number(disposal.quantity),
      })),
    });
  } catch (error) {
    console.error("Get device disposals error:", error);
    return res.status(500).json({
      message: "Failed to retrieve disposal history",
    });
  }
};

module.exports = {
  recordMaterialRecovery,
  getMaterialRecoveries,
  getMaterialRecovery,
  recordDisposal,
  getDeviceDisposals,
};
