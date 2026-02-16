-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'audio', 'document', 'interactive', 'template', 'unknown');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('sent', 'accepted', 'read', 'delivered', 'deleted', 'failed');

-- CreateTable
CREATE TABLE "Contact" (
    "waId" TEXT NOT NULL,
    "profileName" TEXT,
    "phoneNumber" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("waId")
);

-- CreateTable
CREATE TABLE "Message" (
    "waId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "messageDirection" "MessageDirection" NOT NULL,
    "messageType" "MessageType" NOT NULL DEFAULT 'unknown',
    "message" TEXT,
    "timeStamp" TEXT,
    "currentStatus" "MessageStatus",
    "currentStatusAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("waId")
);

-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL,
    "wamId" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "timeStamp" TIMESTAMP(3) NOT NULL,
    "recipientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageError" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "errorCode" INTEGER NOT NULL DEFAULT 0,
    "ErrorTitle" TEXT,
    "lastErrorDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_contactId_createdAt_idx" ON "Message"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_currentStatus_currentStatusAt_idx" ON "Message"("currentStatus", "currentStatusAt");

-- CreateIndex
CREATE INDEX "Message_contactId_currentStatus_currentStatusAt_idx" ON "Message"("contactId", "currentStatus", "currentStatusAt");

-- CreateIndex
CREATE INDEX "Status_wamId_timeStamp_idx" ON "Status"("wamId", "timeStamp");

-- CreateIndex
CREATE INDEX "Status_wamId_status_idx" ON "Status"("wamId", "status");

-- CreateIndex
CREATE INDEX "Status_status_timeStamp_idx" ON "Status"("status", "timeStamp");

-- CreateIndex
CREATE UNIQUE INDEX "Status_wamId_status_timeStamp_key" ON "Status"("wamId", "status", "timeStamp");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("waId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_wamId_fkey" FOREIGN KEY ("wamId") REFERENCES "Message"("waId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageError" ADD CONSTRAINT "MessageError_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("waId") ON DELETE CASCADE ON UPDATE CASCADE;
