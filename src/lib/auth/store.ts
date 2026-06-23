/**
 * Prisma-backed magic-link + session store. Server-only.
 *
 * Magic links are single-use and short-lived; sessions back the HTTP-only
 * auth cookie. All tokens are stored hashed (see ./tokens).
 */
import type { PrismaClient } from "@prisma/client";
import { generateToken, hashToken, expiryFromNow, isExpired } from "./tokens";

export const MAGIC_LINK_TTL_MINUTES = 15;
export const SESSION_TTL_DAYS = 30;

/** Mint a single-use magic link for an email. Returns the raw token. */
export async function createMagicLink(
  prisma: PrismaClient,
  email: string,
  ttlMinutes = MAGIC_LINK_TTL_MINUTES,
): Promise<string> {
  const token = generateToken();
  await prisma.magicLink.create({
    data: {
      email: email.toLowerCase(),
      tokenHash: hashToken(token),
      expiresAt: expiryFromNow(ttlMinutes),
    },
  });
  return token;
}

/** Consume a magic link: returns the email if valid+unused+unexpired, else null. */
export async function consumeMagicLink(prisma: PrismaClient, token: string): Promise<string | null> {
  const row = await prisma.magicLink.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || isExpired(row.expiresAt)) return null;
  await prisma.magicLink.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.email;
}

/** Create a session for an agent. Returns the raw cookie token. */
export async function createSession(
  prisma: PrismaClient,
  agentId: string,
  ttlDays = SESSION_TTL_DAYS,
): Promise<string> {
  const token = generateToken();
  await prisma.authSession.create({
    data: { agentId, tokenHash: hashToken(token), expiresAt: expiryFromNow(ttlDays * 24 * 60) },
  });
  return token;
}

/** Resolve a session token to an agent id, or null when invalid/expired. */
export async function lookupSession(prisma: PrismaClient, token: string): Promise<string | null> {
  const row = await prisma.authSession.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || isExpired(row.expiresAt)) return null;
  return row.agentId;
}

export async function deleteSession(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}
