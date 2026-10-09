const prisma = require("../utils/prisma");

async function createRecyclingRequest(req, res) {
  try {
    const { deviceId, organizationId, pickupAddress, requestedDate } = req.body;

    // Check that the client supplied the required values.
    if (!deviceId || !organizationId || !pickupAddress || !requestedDate) {
      return res.status(400).json({
        error: "deviceId, organizationId, pickupAddress, and requestedDate are required",
      });
    }

    // Use the logged-in user's ID, not an ownerId supplied by the client.
    const device = await prisma.device.findFirst({
      where: { id: deviceId, ownerId: req.user.id },
      select: { id: true },
    });

    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    const date = new Date(requestedDate);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: "requestedDate must be a valid date" });
    }

    // Create the recycling request and its pickup details together.
    const request = await prisma.recyclingRequest.create({
      data: {
        device: { connect: { id: deviceId } },
        organization: { connect: { id: organizationId } },
        collectionMethod: "PICKUP",
        pickupRequest: {
          create: {
            pickupAddress: pickupAddress.trim(),
            requestedDate: date,
          },
        },
      },
      include: { pickupRequest: true },
    });

    return res.status(201).json({ request });
  } catch (error) {
    console.error("Create recycling request error:", error);
    return res.status(500).json({ error: "Unable to create recycling request" });
  }
}

async function cancelRecyclingRequest(req, res) {
  const { id } = req.params;
  const cancellableStatuses = ["PENDING", "ACCEPTED", "SCHEDULED"];

  try {
    const request = await prisma.recyclingRequest.findFirst({
      where: {
        id,
        device: { ownerId: req.user.id },
      },
      include: { pickupRequest: true },
    });

    if (!request) {
      return res.status(404).json({ error: "Recycling request not found" });
    }

    if (!cancellableStatuses.includes(request.status)) {
      return res.status(409).json({
        error: `A request with status ${request.status} cannot be cancelled`,
      });
    }

    const cancelledRequest = await prisma.$transaction(async (transaction) => {
      const result = await transaction.recyclingRequest.updateMany({
        where: {
          id,
          status: { in: cancellableStatuses },
        },
        data: { status: "CANCELLED" },
      });

      if (result.count === 0) {
        return null;
      }

      if (request.pickupRequest) {
        await transaction.pickupRequest.update({
          where: { recyclingRequestId: id },
          data: { status: "CANCELLED" },
        });
      }

      return transaction.recyclingRequest.findUnique({
        where: { id },
        include: { pickupRequest: true },
      });
    });

    if (!cancelledRequest) {
      return res.status(409).json({ error: "This request can no longer be cancelled" });
    }

    return res.json({ request: cancelledRequest });
  } catch (error) {
    console.error("Cancel recycling request error:", error);
    return res.status(500).json({ error: "Unable to cancel recycling request" });
  }
}

module.exports = { createRecyclingRequest, cancelRecyclingRequest };