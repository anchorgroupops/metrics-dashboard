/**
 * Pure token helpers for magic-link auth. Tokens are random and stored hashed
 * (SHA-256) so a database leak never exposes a usable token. Server-only.
 */
import { randomBytes, createHash } from "node:crypto";

/** A URL-safe random token (~43 chars). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Deterministic hash for storage/lookup. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function expiryFromNow(minutes: number, now: number = Date.now()): Date {
  return new Date(now + minutes * 60_000);
}

export function isExpired(at: Date, now: number = Date.now()): boolean {
  return at.getTime() <= now;
}
