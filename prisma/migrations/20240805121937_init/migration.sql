/*
  Warnings:

  - Changed the type of `chatId` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "chatId",
ADD COLUMN     "chatId" BIGINT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_chatId_key" ON "User"("chatId");
