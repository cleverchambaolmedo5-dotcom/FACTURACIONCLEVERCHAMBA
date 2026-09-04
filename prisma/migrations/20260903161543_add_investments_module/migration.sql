-- CreateEnum
CREATE TYPE "InvestmentStatus" AS ENUM ('PENDING_VALIDATION', 'ACTIVE', 'MATURED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "address" TEXT;

-- CreateTable
CREATE TABLE "Investment" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "principalAmount" DECIMAL(12,2) NOT NULL,
    "annualRate" DECIMAL(5,2) NOT NULL DEFAULT 13.00,
    "startDate" TIMESTAMP(3) NOT NULL,
    "firstReturnDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "status" "InvestmentStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "validatedById" UUID,
    "validatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledById" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentReceipt" (
    "id" UUID NOT NULL,
    "investmentId" UUID NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentContract" (
    "id" UUID NOT NULL,
    "investmentId" UUID NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Investment_customerId_idx" ON "Investment"("customerId");

-- CreateIndex
CREATE INDEX "Investment_sellerId_idx" ON "Investment"("sellerId");

-- CreateIndex
CREATE INDEX "Investment_status_idx" ON "Investment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentReceipt_investmentId_key" ON "InvestmentReceipt"("investmentId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentContract_investmentId_key" ON "InvestmentContract"("investmentId");

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentReceipt" ADD CONSTRAINT "InvestmentReceipt_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentReceipt" ADD CONSTRAINT "InvestmentReceipt_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentContract" ADD CONSTRAINT "InvestmentContract_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentContract" ADD CONSTRAINT "InvestmentContract_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
