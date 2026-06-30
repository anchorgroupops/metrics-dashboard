import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMagicLink } from "@/lib/auth/store";
import { sendMagicLinkEmail } from "@/lib/auth/email";

export const dynamic = "force-dynamic";

/**
 * Request a magic link. Always redirects to /login?sent=1 regardless of whether
 * the email matches a known agent — no account enumeration.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim().toLowerCase();

  if (email) {
    try {
      const agent = await prisma.agent.findFirst({ where: { email } });
      if (agent) {
        const token = await createMagicLink(prisma, email);
        const base = process.env.PORTAL_BASE_URL ?? req.nextUrl.origin;
        const url = `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;
        await sendMagicLinkEmail(email, url);
      }
    } catch {
      // Swallow — never reveal whether the address exists or the DB is down.
    }
  }

  return NextResponse.redirect(new URL("/login?sent=1", req.nextUrl.origin), { status: 303 });
}
