-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "companyName" TEXT NOT NULL DEFAULT '',
    "companyTaxId" TEXT NOT NULL DEFAULT '',
    "companyEmail" TEXT NOT NULL DEFAULT '',
    "companyPhone" TEXT NOT NULL DEFAULT '',
    "companyAddress" TEXT NOT NULL DEFAULT '',
    "saleDefaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "saleMaxInstallments" INTEGER NOT NULL DEFAULT 3,
    "salePaymentTermDays" INTEGER NOT NULL DEFAULT 30,
    "notifyOnNewSale" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnPaymentDue" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnOverduePayment" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "primaryColor" TEXT NOT NULL DEFAULT '#4f46e5',
    "locale" TEXT NOT NULL DEFAULT 'es-EC',
    "timezone" TEXT NOT NULL DEFAULT 'America/Guayaquil',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
