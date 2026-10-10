const crypto = require("crypto");

const createEventWithLedger = async (tx, eventData) => {
  const { deviceId } = eventData;

  // Serialize ledger updates for this device to prevent competing
  // transactions from creating entries with the same previous hash.
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtext(${deviceId}))
  `;

  // Create the event.
  const event = await tx.event.create({
    data: eventData,
  });

  // Find the latest entry in this device's ledger chain.
  const previousEntry = await tx.ledgerEntry.findFirst({
    where: { deviceId },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  });

  const previousHash = previousEntry?.currentHash ?? null;

  // Build a deterministic representation of the event.
  const eventPayload = {
    id: event.id,
    deviceId: event.deviceId,
    eventType: event.eventType,
    performedBy: event.performedBy,
    organizationId: event.organizationId,
    fromOrganizationId: event.fromOrganizationId,
    toOrganizationId: event.toOrganizationId,
    remarks: event.remarks,
    createdAt: event.createdAt.toISOString(),
    previousHash,
  };

  // Calculate the SHA-256 hash.
  const currentHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(eventPayload))
    .digest("hex");

  // Create the ledger entry linked to the event and previous entry.
  const ledgerEntry = await tx.ledgerEntry.create({
    data: {
      eventId: event.id,
      deviceId: event.deviceId,
      previousLedgerId: previousEntry?.id ?? null,
      previousHash,
      currentHash,
    },
  });

  return { event, ledgerEntry };
};

module.exports = { createEventWithLedger };