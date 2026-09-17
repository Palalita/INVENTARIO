import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { isR2Configured, r2Client } from "../../config/r2";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { CreateProductInput, ListProductsQuery, UpdateProductInput } from "./products.schemas";

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

// El middleware de subida (multer) solo valida el Content-Type que el propio
// cliente declara en el multipart, que se puede falsificar. Antes de aceptar
// el archivo revisamos los primeros bytes contra la firma real del formato,
// para que un archivo cualquiera con Content-Type falso ("image/png" en un
// .html, por ejemplo) no llegue a subirse ni a guardarse en R2.
const IMAGE_SIGNATURES: Record<string, (buf: Buffer) => boolean> = {
  "image/png": (buf) =>
    buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  "image/webp": (buf) =>
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
};

function assertValidImageContent(file: Express.Multer.File) {
  const matchesSignature = IMAGE_SIGNATURES[file.mimetype];
  if (!matchesSignature || !matchesSignature(file.buffer)) {
    throw AppError.badRequest(
      "El archivo no es una imagen válida del tipo declarado",
      "INVALID_FILE_CONTENT"
    );
  }
}

function keyFromImageUrl(imageUrl: string): string {
  return imageUrl.replace(`${env.R2_PUBLIC_URL}/`, "");
}

export async function listProducts(query: ListProductsQuery) {
  const { skip, take, page, pageSize } = getPaginationArgs(query);

  const where: Prisma.ProductWhereInput = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { sku: { contains: query.search, mode: "insensitive" } }
    ];
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.lowStock) {
    // stock <= minStock: no se puede comparar dos columnas directamente con el
    // filtro de Prisma, se resuelve con una raw query de soporte.
    const lowStockIds = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Product" WHERE stock <= "minStock"
    `;
    where.id = { in: lowStockIds.map((p) => p.id) };
  }

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      include: { category: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.product.count({ where })
  ]);

  return buildPaginatedResponse(data, total, page, pageSize);
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: { category: true } });
  if (!product) {
    throw AppError.notFound("Producto no encontrado");
  }
  return product;
}

export async function createProduct(input: CreateProductInput) {
  const existing = await prisma.product.findUnique({ where: { sku: input.sku } });
  if (existing) {
    throw AppError.conflict("Ya existe un producto con ese SKU", "DUPLICATE_SKU");
  }
  return prisma.product.create({
    data: {
      sku: input.sku,
      name: input.name,
      description: input.description,
      categoryId: input.categoryId ?? undefined,
      price: input.price,
      cost: input.cost,
      stock: input.stock,
      minStock: input.minStock
    },
    include: { category: true }
  });
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Producto no encontrado");
  }

  if (input.sku && input.sku !== existing.sku) {
    const skuTaken = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (skuTaken) {
      throw AppError.conflict("Ya existe un producto con ese SKU", "DUPLICATE_SKU");
    }
  }

  return prisma.product.update({
    where: { id },
    data: {
      ...input,
      categoryId: input.categoryId === undefined ? undefined : input.categoryId
    },
    include: { category: true }
  });
}

export async function deleteProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Producto no encontrado");
  }
  await prisma.product.update({ where: { id }, data: { active: false } });
}

export async function uploadProductImage(id: string, file: Express.Multer.File) {
  // La validación del contenido del archivo es una regla de entrada pura y no
  // depende de si R2 está configurado, así que se revisa primero.
  assertValidImageContent(file);

  if (!isR2Configured || !r2Client) {
    throw AppError.badRequest(
      "El almacenamiento de imágenes no está configurado (faltan las variables R2_* en el backend)",
      "IMAGE_STORAGE_NOT_CONFIGURED"
    );
  }

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Producto no encontrado");
  }

  const extension = EXTENSION_BY_MIME_TYPE[file.mimetype] ?? "jpg";
  const key = `products/${id}-${randomUUID()}.${extension}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
    })
  );

  // Borra la imagen anterior del bucket para no dejar archivos huérfanos.
  // Si falla (p. ej. ya no existe), no debe impedir que se guarde la nueva.
  if (existing.imageUrl) {
    await r2Client
      .send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: keyFromImageUrl(existing.imageUrl) }))
      .catch(() => undefined);
  }

  return prisma.product.update({
    where: { id },
    data: { imageUrl: `${env.R2_PUBLIC_URL}/${key}` },
    include: { category: true }
  });
}

export async function deleteProductImage(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Producto no encontrado");
  }

  if (existing.imageUrl && isR2Configured && r2Client) {
    await r2Client
      .send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: keyFromImageUrl(existing.imageUrl) }))
      .catch(() => undefined);
  }

  return prisma.product.update({
    where: { id },
    data: { imageUrl: null },
    include: { category: true }
  });
}
