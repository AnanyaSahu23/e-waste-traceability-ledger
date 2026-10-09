const prisma = require("../utils/prisma");

// Create a recycling request with pickup details
async function createRecyclingRequest(req, res) {
  try {
    const {
      deviceId,
      organizationId,
      pickupAddress,
      requestedDate,
    } = req.body;

    if (
      !deviceId ||
      !organizationId ||
      !pickupAddress?.trim() ||
      !requestedDate
    ) {
      return res.status(400).json({
        error:
          "deviceId, organizationId, pickupAddress, and requestedDate are required",
      });
    }

    const date = new Date(requestedDate);

    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({
        error: "requestedDate must be a valid future date",
      });
    }

    // Ensure the device belongs to the logged-in user.
    const device = await prisma.device.findFirst({
      where: {
        id: deviceId,
        ownerId: req.user.id,
      },
      select: { id: true },
    });

    if (!device) {
      return res.status(404).json({
        error: "Device not found",
      });
    }

    // Ensure the selected organization exists.
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!organization) {
      return res.status(404).json({
        error: "Organization not found",
      });
    }

    // Prevent multiple active recycling requests for the same device.
    const existingRequest = await prisma.recyclingRequest.findFirst({
      where: {
        deviceId,
        status: {
          in: ["PENDING", "ACCEPTED", "SCHEDULED"],
        },
      },
      select: { id: true },
    });

    if (existingRequest) {
      return res.status(409).json({
        error: "This device already has an active recycling request",
      });
    }

    const request = await prisma.recyclingRequest.create({
      data: {
        device: {
          connect: { id: deviceId },
        },
        organization: {
          connect: { id: organizationId },
        },
        collectionMethod: "PICKUP",
        pickupRequest: {
          create: {
            pickupAddress: pickupAddress.trim(),
            requestedDate: date,
          },
        },
      },
      include: {
        device: true,
        organization: true,
        pickupRequest: true,
      },
    });

    return res.status(201).json({ request });
  } catch (error) {
    console.error("Create recycling request error:", error);

    return res.status(500).json({
      error: "Unable to create recycling request",
    });
  }
}


// Get all recycling requests belonging to the logged-in user
async function getAllRecyclingRequests(req, res) {
  try {
    const requests = await prisma.recyclingRequest.findMany({
      where: {
        device: {
          ownerId: req.user.id,
        },
      },
      include: {
        device: true,
        organization: true,
        pickupRequest: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({ requests });
  } catch (error) {
    console.error("Get recycling requests error:", error);

    return res.status(500).json({
      error: "Unable to retrieve recycling requests",
    });
  }
}


// Get one recycling request by ID
async function getRecyclingRequestById(req, res) {
  try {
    const { id } = req.params;

    const request = await prisma.recyclingRequest.findFirst({
      where: {
        id,
        device: {
          ownerId: req.user.id,
        },
      },
      include: {
        device: true,
        organization: true,
        pickupRequest: true,
      },
    });

    if (!request) {
      return res.status(404).json({
        error: "Recycling request not found",
      });
    }

    return res.status(200).json({ request });
  } catch (error) {
    console.error("Get recycling request error:", error);

    return res.status(500).json({
      error: "Unable to retrieve recycling request",
    });
  }
}


// Cancel a recycling request and its associated pickup
async function cancelRecyclingRequest(req, res) {
  const { id } = req.params;

  const cancellableStatuses = [
    "PENDING",
    "ACCEPTED",
    "SCHEDULED",
  ];

  try {
    const request = await prisma.recyclingRequest.findFirst({
      where: {
        id,
        device: {
          ownerId: req.user.id,
        },
      },
      include: {
        pickupRequest: true,
      },
    });

    if (!request) {
      return res.status(404).json({
        error: "Recycling request not found",
      });
    }

    if (!cancellableStatuses.includes(request.status)) {
      return res.status(409).json({
        error: `A request with status ${request.status} cannot be cancelled`,
      });
    }

    // Don't cancel a request if its pickup has already been completed.
    if (request.pickupRequest?.status === "COMPLETED") {
      return res.status(409).json({
        error: "A completed pickup cannot be cancelled",
      });
    }

    const cancelledRequest = await prisma.$transaction(
      async (transaction) => {
        const result =
          await transaction.recyclingRequest.updateMany({
            where: {
              id,
              device: {
                ownerId: req.user.id,
              },
              status: {
                in: cancellableStatuses,
              },
            },
            data: {
              status: "CANCELLED",
            },
          });

        if (result.count === 0) {
          return null;
        }

        if (request.pickupRequest) {
          await transaction.pickupRequest.update({
            where: {
              recyclingRequestId: id,
            },
            data: {
              status: "CANCELLED",
            },
          });
        }

        return transaction.recyclingRequest.findUnique({
          where: { id },
          include: {
            device: true,
            organization: true,
            pickupRequest: true,
          },
        });
      }
    );

    if (!cancelledRequest) {
      return res.status(409).json({
        error: "This request can no longer be cancelled",
      });
    }

    return res.status(200).json({
      message: "Recycling request cancelled successfully",
      request: cancelledRequest,
    });
  } catch (error) {
    console.error("Cancel recycling request error:", error);

    return res.status(500).json({
      error: "Unable to cancel recycling request",
    });
  }
}


module.exports = {
  createRecyclingRequest,
  getAllRecyclingRequests,
  getRecyclingRequestById,
  cancelRecyclingRequest,
};
