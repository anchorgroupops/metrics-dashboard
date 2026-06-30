import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteSession } from "@/lib/auth/store";
import { SESSION_COOKIE } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await deleteSession(prisma, token);
    } catch {
      // ignore — clearing the cookie below still signs the user out
    }
  }
  const res = NextResponse.redirect(new URL("/login", req.nextUrl.origin), { status: 303 });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
