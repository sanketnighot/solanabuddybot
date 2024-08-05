/*
  Warnings:

  - You are about to drop the `Alert` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_UserAlerts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_UserAlerts" DROP CONSTRAINT "_UserAlerts_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserAlerts" DROP CONSTRAINT "_UserAlerts_B_fkey";

-- DropTable
DROP TABLE "Alert";

-- DropTable
DROP TABLE "_UserAlerts";

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_UserSubscriptions" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_UserSubscriptions_AB_unique" ON "_UserSubscriptions"("A", "B");

-- CreateIndex
CREATE INDEX "_UserSubscriptions_B_index" ON "_UserSubscriptions"("B");

-- AddForeignKey
ALTER TABLE "_UserSubscriptions" ADD CONSTRAINT "_UserSubscriptions_A_fkey" FOREIGN KEY ("A") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserSubscriptions" ADD CONSTRAINT "_UserSubscriptions_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
