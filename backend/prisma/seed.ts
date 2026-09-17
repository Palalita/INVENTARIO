import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

const DEFAULT_ADMIN_PASSWORD = "Admin123!";

async function main() {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const adminEmail = "admin@inventario.local";

  // No permitir que el admin de producción quede con la contraseña por
  // defecto (que cualquiera puede leer en este mismo archivo, público en el
  // repositorio). En desarrollo/test sí se permite, por comodidad.
  if (process.env.NODE_ENV === "production" && adminPassword === DEFAULT_ADMIN_PASSWORD) {
    console.error(
      "El seed se negó a correr: NODE_ENV=production pero ADMIN_SEED_PASSWORD no está " +
        "configurado (o usa el valor por defecto). Define una contraseña fuerte en " +
        "ADMIN_SEED_PASSWORD antes de correr el seed en producción."
    );
    process.exit(1);
  }

  const adminPasswordHash = await bcrypt.hash(adminPassword, BCRYPT_COST);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Administrador",
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      active: true
    }
  });
  console.log(`Usuario admin listo: ${admin.email}`);

  const categoriesData = [
    { name: "Electrónica" },
    { name: "Oficina" },
    { name: "Hogar" }
  ];

  const categories = [];
  for (const c of categoriesData) {
    const category = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c
    });
    categories.push(category);
  }
  console.log(`Categorías listas: ${categories.map((c) => c.name).join(", ")}`);

  const productsData = [
    {
      sku: "ELEC-001",
      name: "Mouse inalámbrico",
      description: "Mouse inalámbrico ergonómico",
      categoryId: categories[0].id,
      price: 15.99,
      cost: 8.5,
      stock: 50,
      minStock: 10
    },
    {
      sku: "OFI-001",
      name: "Resma de papel bond carta",
      description: "Resma de 500 hojas tamaño carta",
      categoryId: categories[1].id,
      price: 5.5,
      cost: 3.2,
      stock: 100,
      minStock: 20
    }
  ];

  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p
    });
    console.log(`Producto listo: ${product.sku} - ${product.name}`);
  }

  const client = await prisma.client.upsert({
    where: { nit: "CF-0001" },
    update: {},
    create: {
      name: "Consumidor Final",
      nit: "CF-0001",
      email: "cliente@example.com",
      phone: "00000000",
      address: "Ciudad de Guatemala"
    }
  });
  console.log(`Cliente listo: ${client.name}`);
}

main()
  .catch((err) => {
    console.error("Error ejecutando el seed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
