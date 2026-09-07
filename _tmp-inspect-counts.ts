import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const [sales, installments, payments, receipts, users] = await Promise.all([
    prisma.sale.count(),
    prisma.installment.count(),
    prisma.payment.count(),
    prisma.paymentReceipt.count(),
    prisma.user.count(),
  ]);
  console.log({ sales, installments, payments, receipts, users });

  const installmentsWithBalance = await prisma.installment.findMany({
    take: 5,
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      installmentNumber: true,
      amount: true,
      status: true,
      sale: { select: { id: true, customer: { select: { fullName: true } } } },
    },
  });
  console.log("sample installments:", JSON.stringify(installmentsWithBalance, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
