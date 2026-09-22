// Lógica de negocio de autenticación: login, refresh de sesión y logout.
// Los controladores (auth.controller.ts) solo llaman a estas funciones y
// traducen su resultado a la respuesta HTTP (incluida la cookie del refresh
// token); toda la parte de contraseñas/tokens vive aquí.
//
// Modelo de sesión usado: un access token JWT de corta duración (15 min,
// sin estado en la base de datos, se verifica solo con la firma) + un
// refresh token opaco de larga duración (7 días, sí se guarda en la tabla
// RefreshToken) que viaja en una cookie httpOnly. Cuando el access token
// expira, el frontend llama a /auth/refresh con la cookie para obtener uno
// nuevo sin pedirle la contraseña de nuevo al usuario.
import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { LoginInput } from "./auth.schemas";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

// El refresh token que recibe el navegador es un UUID aleatorio "en claro"
// (rawToken); en la base de datos solo se guarda su HMAC-SHA256
// (tokenHash), nunca el valor real. Así, si alguien leyera la base de datos,
// no podría reconstruir un token válido para hacerse pasar por un usuario.
function hashRefreshToken(rawToken: string): string {
  return crypto.createHmac("sha256", env.REFRESH_TOKEN_SECRET).update(rawToken).digest("hex");
}

// Sin esto, la tabla RefreshToken crece para siempre: cada login/refresh
// inserta una fila nueva y las viejas solo se marcan `revoked`, nunca se
// borran. Una vez vencido (expiresAt en el pasado) el token ya es rechazado
// por el chequeo de refresh() sin importar `revoked`, así que borrarlo no
// debilita la detección de reuso de tokens todavía vigentes — se aprovecha
// cada login/refresh del propio usuario para podar sus filas vencidas en vez
// de necesitar un job periódico aparte.
async function pruneExpiredRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
}

// Firma un JWT de acceso con los datos mínimos necesarios para autorizar
// requests (id, email, rol), sin tocar la base de datos — por eso
// requireAuth (middlewares/auth.ts) puede verificar un access token sin
// hacer una query.
function signAccessToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL
  });
}

// Campos de User seguros para exponer al cliente (sin passwordHash). Se usa
// tanto en getMe() como, vía desestructuración manual, en login().
const userSafeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true
} as const;

// Hash bcrypt "de mentira" (de una contraseña que nadie usa) contra el que
// comparar cuando el email no existe o el usuario está inactivo. Sin esto,
// ese camino responde de inmediato mientras que un email real con password
// incorrecta espera los ~60-100ms de bcrypt.compare() — esa diferencia de
// tiempo deja adivinar qué emails existen en el sistema, aun sin ver nunca
// el mensaje de error (que ya es genérico a propósito).
const DUMMY_PASSWORD_HASH = "$2b$12$adx9jrS88/CpSzwOzKtbVuZESHEGio5o4TFo7H6cTh.2VbEj1tpPi";

// Verifica email+contraseña, y si son correctos emite un access token nuevo
// y crea un refresh token nuevo en la base de datos. Rechaza tanto
// credenciales incorrectas como usuarios desactivados (`active: false`) con
// el mismo mensaje genérico, para no revelar si el problema fue el email o
// la contraseña ni si la cuenta existe pero está deshabilitada.
export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // bcrypt.compare() corre siempre, exista o no el usuario, para que ambos
  // caminos tarden lo mismo (ver DUMMY_PASSWORD_HASH arriba).
  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !user.active) {
    throw AppError.unauthorized("Credenciales inválidas", "INVALID_CREDENTIALS");
  }

  if (!passwordMatches) {
    throw AppError.unauthorized("Credenciales inválidas", "INVALID_CREDENTIALS");
  }

  const accessToken = signAccessToken(user);
  const rawRefreshToken = uuidv4();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(rawRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
    }
  });

  const { passwordHash: _passwordHash, ...safeUser } = user;

  await pruneExpiredRefreshTokens(user.id);

  return { user: safeUser, accessToken, rawRefreshToken };
}

// Canjea un refresh token válido por un access token nuevo. Implementa
// "rotación": el refresh token usado se marca `revoked: true` y se crea uno
// completamente nuevo en la misma transacción — así un refresh token nunca
// se puede reusar dos veces. Si alguien roba un refresh token viejo y lo usa
// después de que el dueño ya lo rotó, esta función lo rechaza (`revoked` ya
// es true), lo que sirve como señal de que ese token fue comprometido.
export async function refresh(rawToken: string | undefined) {
  if (!rawToken) {
    throw AppError.unauthorized("Refresh token requerido", "NO_REFRESH_TOKEN");
  }

  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true }
  });

  if (!existing) {
    throw AppError.unauthorized("Refresh token inválido o expirado", "INVALID_REFRESH_TOKEN");
  }

  // Un token que YA estaba revocado volviendo a presentarse no es un simple
  // "vencido": es la señal de que alguien más lo usó primero (el dueño ya lo
  // rotó, o se lo robaron y el ladrón llegó antes). Antes solo se rechazaba
  // esta request puntual, dejando viva la sesión que sí logró rotarlo — si
  // fue un robo, el atacante se queda con acceso hasta que su token expire
  // solo. Ahora se trata como compromiso de cuenta: se revocan TODOS los
  // refresh tokens activos del usuario, forzando re-login en todos lados.
  if (existing.revoked) {
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revoked: false },
      data: { revoked: true }
    });
    throw AppError.unauthorized("Refresh token inválido o expirado", "INVALID_REFRESH_TOKEN");
  }

  if (existing.expiresAt < new Date() || !existing.user.active) {
    throw AppError.unauthorized("Refresh token inválido o expirado", "INVALID_REFRESH_TOKEN");
  }

  const newRawToken = uuidv4();

  // El `findFirst` de arriba pudo quedar obsoleto: si dos requests llegan
  // con el mismo rawToken casi al mismo tiempo (el caso real es un atacante
  // que ya robó el token, compitiendo contra el próximo refresh normal del
  // dueño), ambas podían leer `revoked: false` y ambas rotar con éxito,
  // generando dos sesiones hijas independientes sin que la detección de
  // reuso de arriba se disparara nunca — anulando esa protección por
  // completo. El `updateMany` de abajo es un compare-and-swap atómico
  // (mismo patrón que createInvoice() usa para el stock en
  // invoices.service.ts): solo UNA request concurrente puede ganarlo,
  // porque Postgres re-evalúa `revoked: false` contra el estado ya
  // confirmado, no contra la lectura de arriba.
  const rotated = await prisma.$transaction(async (tx) => {
    const claim = await tx.refreshToken.updateMany({
      where: { id: existing.id, revoked: false },
      data: { revoked: true }
    });
    if (claim.count === 0) return false;

    await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hashRefreshToken(newRawToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
      }
    });
    return true;
  });

  if (!rotated) {
    // Perdió la carrera: otra request ya consumió este token entre la
    // lectura y este punto. Se trata igual que el reuso de un token ya
    // revocado (rama de arriba): revocar toda la sesión del usuario, no
    // dejar pasar en silencio.
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revoked: false },
      data: { revoked: true }
    });
    throw AppError.unauthorized("Refresh token inválido o expirado", "INVALID_REFRESH_TOKEN");
  }

  const accessToken = signAccessToken(existing.user);

  await pruneExpiredRefreshTokens(existing.userId);

  return { accessToken, rawRefreshToken: newRawToken };
}

// Revoca el refresh token actual (invalida la sesión del lado del
// servidor). Si no llega ninguna cookie no hace nada — hacer logout sin
// sesión activa no debería ser un error.
export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true }
  });
}

// Devuelve los datos del usuario autenticado (endpoint GET /auth/me), usado
// por el frontend para "restaurar" la sesión al recargar la página.
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSafeSelect });
  if (!user) {
    throw AppError.notFound("Usuario no encontrado");
  }
  return user;
}
