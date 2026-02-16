/*
  Warnings:

  - The primary key for the `Message` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `waId` on the `Message` table. All the data in the column will be lost.
  - Added the required column `wamId` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "MessageError" DROP CONSTRAINT "MessageError_messageId_fkey";

-- DropForeignKey
ALTER TABLE "Status" DROP CONSTRAINT "Status_wamId_fkey";

-- AlterTable
ALTER TABLE "Message" DROP CONSTRAINT "Message_pkey",
DROP COLUMN "waId",
ADD COLUMN     "wamId" TEXT NOT NULL,
ADD CONSTRAINT "Message_pkey" PRIMARY KEY ("wamId");

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_wamId_fkey" FOREIGN KEY ("wamId") REFERENCES "Message"("wamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageError" ADD CONSTRAINT "MessageError_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("wamId") ON DELETE CASCADE ON UPDATE CASCADE;
