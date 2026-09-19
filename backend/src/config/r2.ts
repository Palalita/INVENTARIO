// Cliente para Cloudflare R2 (almacenamiento de objetos compatible con la
// API de S3), usado por products.service.ts para subir/borrar imágenes de
// producto. Se expone también como un cliente S3 normal porque R2 imita esa
// API — no hace falta un SDK propio de Cloudflare.
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

// true solo si las 5 variables R2_* están presentes. Permite que el resto
// del backend arranque igual sin R2 configurado (útil en desarrollo local o
// en un primer despliegue), respondiendo un error claro solo cuando alguien
// intente subir una imagen de verdad (ver products.service.ts).
export const isR2Configured = Boolean(
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME && env.R2_PUBLIC_URL
);

// Cliente S3 apuntando al endpoint de R2 de esta cuenta de Cloudflare, o
// `null` si falta configuración (ver isR2Configured arriba).
export const r2Client = isR2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY as string
      }
    })
  : null;
