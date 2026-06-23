import { redirect } from "next/navigation";
import { getViewerContext, defaultRouteFor } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Role-based landing: management/crew leads → team view, agents → own page. */
export default async function Home() {
  const ctx = await getViewerContext();
  if (!ctx) redirect("/login");
  redirect(defaultRouteFor(ctx));
}
