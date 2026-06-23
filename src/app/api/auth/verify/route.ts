import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeMagicLink, createSession, SESSION_TTL_DAYS } from "@/lib/auth/store";
import { SESSION_COOKIE } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Verify a magic-link token, open a session, and land the viewer on home. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const token = req.nextUrl.searchParams.get("token");
  const fail = () => NextResponse.redirect(new URL("/login?error=1", origin), { status: 303 });
  if (!token) return fail();

  try {
    const email = await consumeMagicLink(prisma, token);
    if (!email) return fail();
    const agent = await prisma.agent.findFirst({ where: { email } });
    if (!agent) return fail();

    const sessionToken = await createSession(prisma, agent.id);
    const res = NextResponse.redirect(new URL("/", origin), { status: 303 });
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.DEPLOYMENT_MODE === "production",
      path: "/",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
    return res;
  } catch {
    return fail();
  }
}
