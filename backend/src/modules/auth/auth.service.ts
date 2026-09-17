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

function hashRefreshToken(rawToken: string): string {
  return crypto.createHmac("sha256", env.REFRESH_TOKEN_SECRET).update(rawToken).digest("hex");
}

function signAccessToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL
  });
}

const userSafeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true
} as const;

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !user.active) {
    throw AppError.unauthorized("Credenciales inválidas", "INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
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

  return { user: safeUser, accessToken, rawRefreshToken };
}

export async function refresh(rawToken: string | undefined) {
  if (!rawToken) {
    throw AppError.unauthorized("Refresh token requerido", "NO_REFRESH_TOKEN");
  }

  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true }
  });

  if (!existing || existing.revoked || existing.expiresAt < new Date() || !existing.user.active) {
    throw AppError.unauthorized("Refresh token inválido o expirado", "INVALID_REFRESH_TOKEN");
  }

  const newRawToken = uuidv4();

  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: existing.id }, data: { revoked: true } }),
    prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hashRefreshToken(newRawToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
      }
    })
  ]);

  const accessToken = signAccessToken(existing.user);

  return { accessToken, rawRefreshToken: newRawToken };
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) return;
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revoked: false },
    data: { revoked: true }
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSafeSelect });
  if (!user) {
    throw AppError.notFound("Usuario no encontrado");
  }
  return user;
}
