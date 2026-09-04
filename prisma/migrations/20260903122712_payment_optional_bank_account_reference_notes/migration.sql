-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bankAccountId_fkey";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "reference" TEXT,
ALTER COLUMN "bankAccountId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
