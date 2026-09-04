/*
  Warnings:

  - Added the required column `assignedSellerId` to the `Customer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "assignedSellerId" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "Customer_assignedSellerId_idx" ON "Customer"("assignedSellerId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedSellerId_fkey" FOREIGN KEY ("assignedSellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
