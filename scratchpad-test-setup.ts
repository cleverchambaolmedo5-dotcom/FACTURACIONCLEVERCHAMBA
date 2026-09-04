import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "./src/lib/prisma";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

async function createSessionForUser(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  return { token, expiresAt };
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@cleverchamba.local" } });
  const accountant = await prisma.user.findUniqueOrThrow({ where: { email: "contabilidad@cleverchamba.local" } });
  const seller1 = await prisma.user.findUniqueOrThrow({ where: { email: "vendedor1@cleverchamba.local" } });
  const seller2 = await prisma.user.findUniqueOrThrow({ where: { email: "vendedor2@cleverchamba.local" } });

  const product = await prisma.product.findFirstOrThrow({ where: { active: true } });

  const customer = await prisma.customer.create({
    data: {
      fullName: "QA TEST Cliente Etapa9",
      identification: `QA-${Date.now()}`,
      phone: "0999999999",
      country: "Ecuador",
      assignedSellerId: seller1.id,
    },
  });

  const sale = await prisma.sale.create({
    data: {
      customerId: customer.id,
      sellerId: seller1.id,
      productId: product.id,
      originalPrice: "500.00",
      discount: "0.00",
      finalPrice: "500.00",
      installments: {
        create: [{ installmentNumber: 1, amount: "500.00", dueDate: new Date(Date.now() + 30 * 86400000) }],
      },
    },
    include: { installments: true },
  });

  const installment = sale.installments[0];

  const adminSession = await createSessionForUser(admin.id);
  const accountantSession = await createSessionForUser(accountant.id);
  const seller1Session = await createSessionForUser(seller1.id);
  const seller2Session = await createSessionForUser(seller2.id);

  console.log(JSON.stringify({
    customerId: customer.id,
    saleId: sale.id,
    installmentId: installment.id,
    admin: { id: admin.id, token: adminSession.token },
    accountant: { id: accountant.id, token: accountantSession.token },
    seller1: { id: seller1.id, token: seller1Session.token },
    seller2: { id: seller2.id, token: seller2Session.token },
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
