// CRUD de productos (el catálogo de inventario) más el manejo de su imagen
// en Cloudflare R2. Es el módulo más grande del backend porque combina
// paginación + búsqueda + filtro de stock bajo + subida/borrado de archivos.
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { isR2Configured, r2Client } from "../../config/r2";
import { AppError } from "../../utils/AppError";
import { getPaginationArgs, buildPaginatedResponse } from "../../utils/pagination";
import { CreateProductInput, ListProductsQuery, UpdateProductInput } from "./products.schemas";

// Para nombrar el archivo subido a R2 con la extensión correcta según el
// tipo de imagen (el nombre original del archivo no se conserva).
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

// Compara los primeros bytes del archivo contra la firma real del formato
// que dice tener (ver comentario de IMAGE_SIGNATURES arriba). Lanza un error
// 400 si no coincide.
function assertValidImageContent(file: Express.Multer.File) {
  const matchesSignature = IMAGE_SIGNATURES[file.mimetype];
  if (!matchesSignature || !matchesSignature(file.buffer)) {
    throw AppError.badRequest(
      "El archivo no es una imagen válida del tipo declarado",
      "INVALID_FILE_CONTENT"
    );
  }
}

// `Product.imageUrl` guarda la URL pública completa (ej.
// "https://pub-xxx.r2.dev/products/abc.png"); para borrar el objeto de R2
// hace falta solo su "key" relativa dentro del bucket ("products/abc.png"),
// así que se le quita el prefijo de la URL pública.
function keyFromImageUrl(imageUrl: string): string {
  return imageUrl.replace(`${env.R2_PUBLIC_URL}/`, "");
}

// Lista paginada de productos con: búsqueda por nombre/SKU, filtro por
// categoría, y filtro de "solo stock bajo" (stock <= minStock). Incluye la
// categoría relacionada en cada producto para no obligar al frontend a
// hacer una segunda consulta.
//
// Nota: esta consulta no oculta `cost` (costo de compra) para VENDEDOR —
// es intencional, confirmado con el dueño del negocio: cualquier usuario
// autenticado puede ver el costo/margen de un producto, no solo ADMIN.
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
    //
    // A propósito SIN LIMIT (a diferencia de la consulta gemela en
    // dashboard.service.ts, que sí tiene LIMIT 100): ahí el resultado se
    // muestra directo sin paginar más, así que "los primeros 100" es
    // correcto. Aquí esta lista de ids solo arma el filtro `where.id` para
    // el `findMany` paginado de abajo — cortarla a 100 dejaría páginas 2+
    // silenciosamente incompletas en un catálogo con más de 100 productos
    // en stock bajo. Es un trade-off de performance (trae todos los ids a
    // memoria) por corrección de la paginación; al tamaño actual del
    // catálogo no es un problema real.
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

// Crea un producto nuevo, rechazando SKU duplicado (el SKU es el
// identificador de negocio que usan los vendedores, debe ser único).
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

// Actualiza campos de un producto existente. Si viene un SKU nuevo distinto
// al actual, revalida que no choque con el de otro producto (igual que en
// createProduct). `stock` NO forma parte de UpdateProductInput (a
// diferencia de CreateProductInput, que sí lo acepta como saldo inicial):
// el único camino para cambiar existencias de un producto ya creado es el
// módulo stock-movements, que además deja un registro auditable de cada
// ajuste (ver el comentario de updateProductSchema para el detalle).
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

// "Borrado" lógico (soft delete): solo marca `active: false`, nunca borra la
// fila. A diferencia de Category/Client, un producto no se puede borrar de
// verdad porque probablemente ya está referenciado por facturas pasadas
// (InvoiceItem) que deben seguir mostrando ese producto en su historial.
export async function deleteProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound("Producto no encontrado");
  }
  await prisma.product.update({ where: { id }, data: { active: false } });
}

// Sube (o reemplaza) la imagen de un producto a R2. Orden de las
// validaciones: primero la firma del archivo (no depende de nada externo),
// luego si R2 está configurado (falla rápido y claro si no), luego si el
// producto existe — así se evita gastar una llamada a R2 para un producto
// que ni siquiera existe, pero también se evita aceptar un archivo inválido
// solo porque R2 esté mal configurado.
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

// Quita la imagen de un producto: borra el objeto en R2 (si existe y R2
// está configurado) y limpia `imageUrl` en la base de datos. No falla si el
// producto no tenía imagen — simplemente no hay nada que borrar en R2 y el
// campo ya queda en null.
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
