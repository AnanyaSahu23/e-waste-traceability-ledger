/*
  Warnings:

  - You are about to drop the `RecoveredMaterial` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RecoveredMaterial" DROP CONSTRAINT "MaterialRecovery_eventId_fkey";

-- DropForeignKey
ALTER TABLE "RecoveredMaterial" DROP CONSTRAINT "MaterialRecovery_materialId_fkey";

-- DropForeignKey
ALTER TABLE "RecoveredMaterial" DROP CONSTRAINT "RecoveredMaterial_recoveryId_fkey";

-- DropTable
DROP TABLE "RecoveredMaterial";

-- CreateTable
CREATE TABLE "MaterialRecovery" (
    "id" UUID NOT NULL,
    "recoveryId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "condition" "MaterialCondition" NOT NULL DEFAULT 'RECYCLABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecoveredMaterial_recoveryId_idx" ON "MaterialRecovery"("recoveryId");

-- CreateIndex
CREATE INDEX "MaterialRecovery_eventId_idx" ON "MaterialRecovery"("eventId");

-- CreateIndex
CREATE INDEX "MaterialRecovery_materialId_idx" ON "MaterialRecovery"("materialId");

-- AddForeignKey
ALTER TABLE "MaterialRecovery" ADD CONSTRAINT "RecoveredMaterial_recoveryId_fkey" FOREIGN KEY ("recoveryId") REFERENCES "MaterialRecoveryOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRecovery" ADD CONSTRAINT "MaterialRecovery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRecovery" ADD CONSTRAINT "MaterialRecovery_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
