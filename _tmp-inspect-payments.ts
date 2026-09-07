import "dotenv/config";
import { prisma } from "@/lib/prisma";

// READ-ONLY inspection script. Does not create, update, or delete anything.
// Lists the most recently created Payment rows with everything needed to
// diagnose the interface-registration flow. Deleted after use.

async function main() {
  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      installment: {
        select: {
          id: true,
          installmentNumber: true,
          status: true,
          amount: true,
          sale: {
            select: {
              id: true,
              status: true,
              bankAccountId: true,
              customer: { select: { fullName: true } },
              product: { select: { name: true } },
              seller: { select: { id: true, name: true, role: true } },
            },
          },
        },
      },
      registeredBy: { select: { id: true, name: true, role: true } },
      validatedBy: { select: { id: true, name: true, role: true } },
      receipt: true,
    },
  });

  for (const p of payments) {
    console.log("=".repeat(80));
    console.log("Payment.id:", p.id);
    console.log("createdAt:", p.createdAt.toISOString());
    console.log("amount:", p.amount.toString());
    console.log("method:", p.method);
    console.log("validationStatus:", p.validationStatus);
    console.log("registeredById:", p.registeredById, "->", p.registeredBy?.name, p.registeredBy?.role);
    console.log("validatedById:", p.validatedById, "->", p.validatedBy?.name ?? null);
    console.log(
      "installmentId:",
      p.installmentId,
      "(#",
      p.installment?.installmentNumber,
      "status:",
      p.installment?.status,
      ")",
    );
    console.log(
      "saleId:",
      p.installment?.sale?.id,
      "status:",
      p.installment?.sale?.status,
      "bankAccountId:",
      p.installment?.sale?.bankAccountId,
    );
    console.log("customer:", p.installment?.sale?.customer?.fullName, "| product:", p.installment?.sale?.product?.name);
    console.log("seller:", p.installment?.sale?.seller?.name, p.installment?.sale?.seller?.role);
    console.log(
      "receipt:",
      p.receipt
        ? { id: p.receipt.id, fileUrl: p.receipt.fileUrl, fileName: p.receipt.fileName, fileType: p.receipt.fileType }
        : null,
    );
  }

  console.log("=".repeat(80));
  console.log("Total payments found:", payments.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
