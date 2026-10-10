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
