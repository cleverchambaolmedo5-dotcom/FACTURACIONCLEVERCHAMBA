import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { ProductType, UserRole, UserStatus } from "../src/generated/prisma/enums";

// Dev-only default password for the seeded users. Read from the
// environment on purpose — it must never be a literal string in source.
// See .env.example for SEED_DEFAULT_PASSWORD.
const SEED_DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;

if (!SEED_DEFAULT_PASSWORD) {
  console.error(
    "\n[seed] Missing SEED_DEFAULT_PASSWORD.\n" +
      "Set it in your .env file before running the seed, e.g.:\n" +
      "  SEED_DEFAULT_PASSWORD=some-dev-only-password\n",
  );
  process.exit(1);
}

type SeedProduct = {
  name: string;
  officialPrice: number;
  type: ProductType;
  active: boolean;
};

// Product.name is used as the logical identifier for this seed, per spec.
const PRODUCTS: SeedProduct[] = [
  { name: "Mentoría Completa", officialPrice: 1497, type: ProductType.MENTORING, active: true },
  { name: "Remates Judiciales", officialPrice: 597, type: ProductType.COURSE, active: true },
  { name: "Educación Financiera", officialPrice: 497, type: ProductType.COURSE, active: true },
  { name: "Marca Personal", officialPrice: 997, type: ProductType.COURSE, active: true },
  { name: "Taller Acelerador", officialPrice: 97, type: ProductType.WORKSHOP, active: true },
  { name: "Asesoría Remates", officialPrice: 1300, type: ProductType.CONSULTING, active: true },
];

type SeedUser = {
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

// User.email is used as the logical identifier for this seed, per spec.
const USERS: SeedUser[] = [
  { name: "Administrador", email: "admin@cleverchamba.local", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
  { name: "Contadora", email: "contabilidad@cleverchamba.local", role: UserRole.ACCOUNTANT, status: UserStatus.ACTIVE },
  { name: "Vendedor 1", email: "vendedor1@cleverchamba.local", role: UserRole.SELLER, status: UserStatus.ACTIVE },
  { name: "Vendedor 2", email: "vendedor2@cleverchamba.local", role: UserRole.SELLER, status: UserStatus.ACTIVE },
];

async function seedProducts() {
  let created = 0;
  let updated = 0;

  for (const product of PRODUCTS) {
    // `Product.name` is unique, so a native Prisma `upsert` works here.
    const existing = await prisma.product.findUnique({
      where: { name: product.name },
    });

    await prisma.product.upsert({
      where: { name: product.name },
      update: {
        officialPrice: product.officialPrice,
        type: product.type,
        active: product.active,
      },
      create: product,
    });

    if (existing) {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated };
}

async function seedUsers(passwordHash: string) {
  let created = 0;
  let preserved = 0;

  for (const user of USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });

    // `email` is unique, so a native Prisma `upsert` works here.
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        status: user.status,
        // passwordHash is intentionally NOT included here: an existing
        // user's password must never be overwritten by the seed.
      },
      create: { ...user, passwordHash },
    });

    if (existing) {
      preserved++;
    } else {
      created++;
    }
  }

  return { created, preserved };
}

async function main() {
  // Hashed once and reused for every newly created user. Never logged.
  const passwordHash = await hash(SEED_DEFAULT_PASSWORD!, 10);

  const products = await seedProducts();
  const users = await seedUsers(passwordHash);

  console.log("\nSeed summary");
  console.log("------------");
  console.log(`Productos creados:                 ${products.created}`);
  console.log(`Productos actualizados:             ${products.updated}`);
  console.log(`Usuarios creados:                   ${users.created}`);
  console.log(`Usuarios existentes conservados:    ${users.preserved}`);
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
