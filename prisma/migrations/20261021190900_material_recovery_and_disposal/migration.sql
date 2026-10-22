-- Rename the existing per-material rows while preserving their data and keys.
ALTER TABLE "MaterialRecovery" RENAME TO "RecoveredMaterial";

-- CreateEnum
CREATE TYPE "MaterialCondition" AS ENUM ('REUSABLE', 'RECYCLABLE', 'OTHER');

-- Add event hash versioning; existing entries retain the original payload format.
ALTER TABLE "Event"
ADD COLUMN "payloadVersion" INTEGER NOT NULL DEFAULT 1;

-- Add recovery-operation linkage and material condition to existing material rows.
ALTER TABLE "RecoveredMaterial"
ADD COLUMN "recoveryId" UUID,
ADD COLUMN "condition" "MaterialCondition" NOT NULL DEFAULT 'RECYCLABLE';

-- CreateTable
CREATE TABLE "MaterialRecoveryOperation" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "organizationId" UUID,
    "performedBy" UUID NOT NULL,
    "idempotencyKey" UUID,
    "requestHash" TEXT,
    "recoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,

    CONSTRAINT "MaterialRecoveryOperation_pkey" PRIMARY KEY ("id")
);

-- Preserve each legacy event's existing recovered-material rows as one operation.
INSERT INTO "MaterialRecoveryOperation" (
    "id",
    "eventId",
    "deviceId",
    "organizationId",
    "performedBy",
    "recoveredAt",
    "remarks"
)
SELECT
    e."id",
    e."id",
    e."deviceId",
    e."organizationId",
    e."performedBy",
    e."createdAt",
    e."remarks"
FROM "Event" e
WHERE EXISTS (
      SELECT 1
      FROM "RecoveredMaterial" rm
      WHERE rm."eventId" = e."id"
  );

UPDATE "RecoveredMaterial" rm
SET "recoveryId" = rm."eventId";

ALTER TABLE "RecoveredMaterial"
ALTER COLUMN "recoveryId" SET NOT NULL;

-- Extend disposal records without inventing measurements for existing records.
ALTER TABLE "DisposalRecord"
ADD COLUMN "deviceId" UUID,
ADD COLUMN "organizationId" UUID,
ADD COLUMN "performedBy" UUID,
ADD COLUMN "idempotencyKey" UUID,
ADD COLUMN "requestHash" TEXT,
ADD COLUMN "quantity" DECIMAL(10,3),
ADD COLUMN "unit" TEXT,
ADD COLUMN "facilityName" TEXT,
ADD COLUMN "hazardous" BOOLEAN NOT NULL DEFAULT false;

UPDATE "DisposalRecord" d
SET
    "deviceId" = e."deviceId",
    "organizationId" = e."organizationId",
    "performedBy" = e."performedBy"
FROM "Event" e
WHERE e."id" = d."eventId";

ALTER TABLE "DisposalRecord"
ALTER COLUMN "deviceId" SET NOT NULL,
ALTER COLUMN "performedBy" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MaterialRecoveryOperation_eventId_key" ON "MaterialRecoveryOperation"("eventId");
CREATE UNIQUE INDEX "MaterialRecoveryOperation_idempotencyKey_key" ON "MaterialRecoveryOperation"("idempotencyKey");
CREATE INDEX "MaterialRecoveryOperation_deviceId_recoveredAt_idx" ON "MaterialRecoveryOperation"("deviceId", "recoveredAt");
CREATE INDEX "MaterialRecoveryOperation_organizationId_idx" ON "MaterialRecoveryOperation"("organizationId");
CREATE INDEX "MaterialRecoveryOperation_performedBy_idx" ON "MaterialRecoveryOperation"("performedBy");

-- CreateIndex
CREATE UNIQUE INDEX "DisposalRecord_idempotencyKey_key" ON "DisposalRecord"("idempotencyKey");
CREATE INDEX "DisposalRecord_deviceId_disposalDate_idx" ON "DisposalRecord"("deviceId", "disposalDate");
CREATE INDEX "DisposalRecord_organizationId_idx" ON "DisposalRecord"("organizationId");
CREATE INDEX "DisposalRecord_performedBy_idx" ON "DisposalRecord"("performedBy");

-- AddForeignKey
ALTER TABLE "MaterialRecoveryOperation"
ADD CONSTRAINT "MaterialRecoveryOperation_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialRecoveryOperation"
ADD CONSTRAINT "MaterialRecoveryOperation_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialRecoveryOperation"
ADD CONSTRAINT "MaterialRecoveryOperation_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialRecoveryOperation"
ADD CONSTRAINT "MaterialRecoveryOperation_performedBy_fkey"
FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecoveredMaterial"
ADD CONSTRAINT "RecoveredMaterial_recoveryId_fkey"
FOREIGN KEY ("recoveryId") REFERENCES "MaterialRecoveryOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DisposalRecord"
ADD CONSTRAINT "DisposalRecord_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DisposalRecord"
ADD CONSTRAINT "DisposalRecord_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisposalRecord"
ADD CONSTRAINT "DisposalRecord_performedBy_fkey"
FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
