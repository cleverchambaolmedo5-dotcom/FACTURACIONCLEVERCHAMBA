-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'DEPOSIT';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receivedByName" TEXT;
