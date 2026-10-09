const prisma = require("../utils/prisma");

// Schedule a pickup and accept the request
const schedulePickup = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate } = req.body;

    if (!scheduledDate) {
      return res.status(400).json({
        message: "Scheduled date is required",
      });
    }

    const date = new Date(scheduledDate);

    if (isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({
        message: "Scheduled date must be a valid future date",
      });
    }

    const pickup = await prisma.pickupRequest.findUnique({
      where: { id },
    });

    if (!pickup) {
      return res.status(404).json({
        message: "Pickup request not found",
      });
    }

    if (pickup.status !== "PENDING" &&
        pickup.status !== "ACCEPTED") {
      return res.status(400).json({
        message: "This pickup cannot be scheduled",
      });
    }

    const updatedPickup = await prisma.pickupRequest.update({
      where: { id },
      data: {
        scheduledDate: date,
        status: "ACCEPTED",
      },
      include: {
        recyclingRequest: {
          include: {
            device: true,
            organization: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Pickup scheduled successfully",
      pickupRequest: updatedPickup,
    });
  } catch (error) {
    console.error("Schedule pickup error:", error);

    return res.status(500).json({
      message: "Failed to schedule pickup",
    });
  }
};


// Update pickup status
const updatePickupStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "ACCEPTED",
      "REJECTED",
      "COMPLETED",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid pickup status",
      });
    }

    const pickup = await prisma.pickupRequest.findUnique({
      where: { id },
      include: {
        recyclingRequest: true,
      },
    });

    if (!pickup) {
      return res.status(404).json({
        message: "Pickup request not found",
      });
    }

    const validTransitions = {
      PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
      ACCEPTED: ["COMPLETED", "CANCELLED"],
      REJECTED: [],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[pickup.status]?.includes(status)) {
      return res.status(400).json({
        message: `Cannot change pickup status from ${pickup.status} to ${status}`,
      });
    }

    // Collection can only be completed after a date is scheduled.
    if (status === "COMPLETED" && !pickup.scheduledDate) {
      return res.status(400).json({
        message: "Schedule the pickup before completing it",
      });
    }

    const updatedPickup = await prisma.$transaction(async (tx) => {
      const updated = await tx.pickupRequest.update({
        where: { id },
        data: { status },
      });

      if (status === "COMPLETED") {
        // req.user.id must be populated by your authentication middleware.
        const performedBy = req.user?.id;

        if (!performedBy) {
          throw new Error(
            "Authenticated user ID is missing from the request"
          );
        }

        await tx.event.create({
          data: {
            deviceId: pickup.recyclingRequest.deviceId,
            eventType: "COLLECTED",
            performedBy,
            organizationId:
              pickup.recyclingRequest.organizationId,
            remarks: "Device collected from the pickup address",
          },
        });
      }

      return updated;
    });

    return res.status(200).json({
      message: `Pickup ${status.toLowerCase()} successfully`,
      pickupRequest: updatedPickup,
    });
  } catch (error) {
    console.error("Update pickup status error:", error);

    return res.status(500).json({
      message: "Failed to update pickup status",
    });
  }
};


// Get all pickup requests
const getPickupRequests = async (req, res) => {
  try {
    const pickupRequests = await prisma.pickupRequest.findMany({
      include: {
        recyclingRequest: {
          include: {
            device: true,
            organization: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(pickupRequests);
  } catch (error) {
    console.error("Get pickup requests error:", error);

    return res.status(500).json({
      message: "Failed to retrieve pickup requests",
    });
  }
};

// Get a pickup request by ID
const getPickupRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id },
      include: {
        recyclingRequest: {
          include: {
            device: true,
            organization: true,
          },
        },
      },
    });

    if (!pickupRequest) {
      return res.status(404).json({
        message: "Pickup request not found",
      });
    }

    return res.status(200).json(pickupRequest);
  } catch (error) {
    console.error("Get pickup request error:", error);

    return res.status(500).json({
      message: "Failed to retrieve pickup request",
    });
  }
};

module.exports = {
  getPickupRequests,
  getPickupRequestById,
  schedulePickup,
  updatePickupStatus,
};
