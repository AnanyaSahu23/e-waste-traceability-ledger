const crypto = require("crypto");

const createEventWithLedger = async (tx, eventData, options = {}) => {
  const { deviceId } = eventData;

  // Serialize ledger updates for this device to prevent competing
  // transactions from creating entries with the same previous hash.
await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(hashtext(${deviceId}))::text AS lock_result
`;
  // Create the event.
  const event = await tx.event.create({
    data: {
      ...eventData,
      payloadVersion: options.createDetails ? 2 : 1,
    },
  });

  const details = options.createDetails
    ? await options.createDetails(tx, event)
    : null;

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
  if (event.payloadVersion === 2) {
    eventPayload.details = details;
  }

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

  return { event, ledgerEntry, details };
};

const verifyDeviceLedger = async (prisma, deviceId) => {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { id: true },
  });

  if (!device) {
    return {
      exists: false,
      valid: false,
      totalEntries: 0,
      errors: ["Device not found"],
    };
  }

  const [events, entries] = await Promise.all([
    prisma.event.findMany({
      where: { deviceId },
      select: { id: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { deviceId },
      include: {
        event: {
          include: {
            recoveryOperation: {
              include: {
                materials: {
                  include: { material: { select: { name: true } } },
                },
              },
            },
            disposalRecord: true,
          },
        },
      },
    }),
  ]);

  const errors = [];
  const eventIds = new Set(events.map((event) => event.id));
  const ledgerEventIds = new Set(entries.map((entry) => entry.eventId));

  // Every event must have a corresponding ledger entry.
  for (const event of events) {
    if (!ledgerEventIds.has(event.id)) {
      errors.push(`Event ${event.id} is missing a ledger entry`);
    }
  }

  // Every ledger entry must reference an existing event.
  for (const entry of entries) {
    if (!eventIds.has(entry.eventId)) {
      errors.push(
        `Ledger entry ${entry.id} references an event not found for this device`
      );
    }

    if (entry.event.deviceId !== deviceId) {
      errors.push(
        `Ledger entry ${entry.id} references an event belonging to another device`
      );
    }
  }

  // An empty ledger is valid only if this device has no events.
  if (entries.length === 0) {
    return {
      exists: true,
      valid: errors.length === 0,
      totalEntries: 0,
      errors,
    };
  }

  // Find the root of the chain.
  const roots = entries.filter(
    (entry) => entry.previousLedgerId === null
  );

  if (roots.length !== 1) {
    errors.push(
      `Expected exactly one chain root, found ${roots.length}`
    );
  }

  const entriesById = new Map(
    entries.map((entry) => [entry.id, entry])
  );

  const childrenByParent = new Map();

  for (const entry of entries) {
    if (entry.previousLedgerId === null) continue;

    if (!entriesById.has(entry.previousLedgerId)) {
      errors.push(
        `Ledger entry ${entry.id} references a missing previous entry`
      );
      continue;
    }

    const children = childrenByParent.get(entry.previousLedgerId) || [];
    children.push(entry);
    childrenByParent.set(entry.previousLedgerId, children);
  }

  // Walk the chain using previousLedgerId links.
  const visited = new Set();
  let current = roots[0] || null;
  let expectedPreviousHash = null;

  while (current) {
    if (visited.has(current.id)) {
      errors.push(`Cycle detected at ledger entry ${current.id}`);
      break;
    }

    visited.add(current.id);

    if (current.previousHash !== expectedPreviousHash) {
      errors.push(
        `Previous hash mismatch at ledger entry ${current.id}`
      );
    }

    if (current.event) {
      // Use the exact payload structure from createEventWithLedger().
      const eventPayload = {
        id: current.event.id,
        deviceId: current.event.deviceId,
        eventType: current.event.eventType,
        performedBy: current.event.performedBy,
        organizationId: current.event.organizationId,
        fromOrganizationId: current.event.fromOrganizationId,
        toOrganizationId: current.event.toOrganizationId,
        remarks: current.event.remarks,
        createdAt: current.event.createdAt.toISOString(),
        previousHash: current.previousHash,
      };

      if (current.event.payloadVersion === 2) {
        if (current.event.eventType === "MATERIAL_RECOVERY") {
          const materials =
            current.event.recoveryOperation?.materials
              .map((material) => ({
                materialType: material.material.name,
                quantity: Number(material.quantity),
                unit: material.unit,
                condition: material.condition,
              }))
              .sort((a, b) =>
                JSON.stringify(a).localeCompare(JSON.stringify(b))
              ) ?? null;
          const recovery = current.event.recoveryOperation;
          eventPayload.details =
            recovery && materials
              ? {
                  recovery: {
                    id: recovery.id,
                    deviceId: recovery.deviceId,
                    organizationId: recovery.organizationId,
                    performedBy: recovery.performedBy,
                    recoveredAt: recovery.recoveredAt.toISOString(),
                    remarks: recovery.remarks,
                  },
                  materials,
                }
              : null;
        } else if (current.event.eventType === "DISPOSAL") {
          const disposal = current.event.disposalRecord;
          eventPayload.details = disposal
            ? {
                disposal: {
                  id: disposal.id,
                  wasteDescription: disposal.wasteDescription,
                  disposalMethod: disposal.disposalMethod,
                  disposalDate: disposal.disposalDate.toISOString(),
                  quantity:
                    disposal.quantity === null
                      ? null
                      : Number(disposal.quantity),
                  unit: disposal.unit,
                  hazardous: disposal.hazardous,
                  facilityName: disposal.facilityName,
                  deviceId: disposal.deviceId,
                  organizationId: disposal.organizationId,
                  performedBy: disposal.performedBy,
                },
              }
            : null;
        } else {
          eventPayload.details = null;
        }
      }

      const calculatedHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(eventPayload))
        .digest("hex");

      if (calculatedHash !== current.currentHash) {
        errors.push(`Hash mismatch at ledger entry ${current.id}`);
      }
    }

    const children = childrenByParent.get(current.id) || [];

    if (children.length > 1) {
      errors.push(
        `Ledger entry ${current.id} has multiple subsequent entries`
      );
      break;
    }

    expectedPreviousHash = current.currentHash;
    current = children[0] || null;
  }

  if (visited.size !== entries.length) {
    errors.push(
      `${entries.length - visited.size} ledger entry/entries are disconnected from the chain`
    );
  }

  return {
    exists: true,
    valid: errors.length === 0,
    totalEntries: entries.length,
    totalEvents: events.length,
    errors,
  };
};

module.exports = { createEventWithLedger, verifyDeviceLedger };