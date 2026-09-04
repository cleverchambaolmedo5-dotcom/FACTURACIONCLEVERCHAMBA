import "dotenv/config";
import { prisma } from "./src/lib/prisma";
async function main() {
  const installment = await prisma.installment.findUnique({
    where: { id: "f05fade2-4a81-4524-b892-4a9ba73a6196" },
    include: { payments: { include: { receipt: true } } },
  });
  console.log(JSON.stringify(installment, null, 2));
}
main().finally(() => prisma.$disconnect());
