const prisma = require("../utils/prisma");
const { verifyDeviceLedger } = require("../utils/ledger");

const getDeviceTracking = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        category: true,
        events: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            organization: true,
            fromOrganization: true,
            toOrganization: true,
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
      return res.status(404).json({
        message: "Device not found",
      });
    }

    const ledgerVerification = await verifyDeviceLedger(
      prisma,
      deviceId
    );

    return res.status(200).json({
      message: "Device tracking history retrieved successfully",
      device: {
        id: device.id,
        brand: device.brand,
        model: device.model,
        serialNumber: device.serialNumber,
        manufactureYear: device.manufactureYear,
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
              quantity:
                event.disposalRecord.quantity === null
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
    console.error("Get device tracking error:", error);

    return res.status(500).json({
      message: "Failed to retrieve device tracking history",
    });
  }
};

module.exports = { getDeviceTracking };
