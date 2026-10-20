-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateTable
CREATE TABLE "CustodyTransfer" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "fromOrganizationId" UUID NOT NULL,
    "toOrganizationId" UUID NOT NULL,
    "requestedBy" UUID NOT NULL,
    "initiatedEventId" UUID NOT NULL,
    "acceptedEventId" UUID,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "CustodyTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustodyTransfer_initiatedEventId_key" ON "CustodyTransfer"("initiatedEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CustodyTransfer_acceptedEventId_key" ON "CustodyTransfer"("acceptedEventId");

-- CreateIndex
CREATE INDEX "CustodyTransfer_deviceId_status_idx" ON "CustodyTransfer"("deviceId", "status");

-- CreateIndex
CREATE INDEX "CustodyTransfer_toOrganizationId_status_idx" ON "CustodyTransfer"("toOrganizationId", "status");

-- AddForeignKey
ALTER TABLE "CustodyTransfer" ADD CONSTRAINT "CustodyTransfer_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyTransfer" ADD CONSTRAINT "CustodyTransfer_fromOrganizationId_fkey" FOREIGN KEY ("fromOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyTransfer" ADD CONSTRAINT "CustodyTransfer_toOrganizationId_fkey" FOREIGN KEY ("toOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyTransfer" ADD CONSTRAINT "CustodyTransfer_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyTransfer" ADD CONSTRAINT "CustodyTransfer_initiatedEventId_fkey" FOREIGN KEY ("initiatedEventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyTransfer" ADD CONSTRAINT "CustodyTransfer_acceptedEventId_fkey" FOREIGN KEY ("acceptedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
