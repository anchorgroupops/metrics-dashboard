import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getViewerContext, defaultRouteFor } from "@/lib/auth/server";
import { canViewAgent } from "@/lib/rbac";
import { AgentScorecard } from "@/components/agent-scorecard";
import { ViewerBar } from "@/components/viewer-bar";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function statusVariant(status: string): "green" | "yellow" | "red" | "neutral" {
  if (status === "Preferred") return "green";
  if (status === "At Risk") return "yellow";
  if (status === "Needs Improvement") return "red";
  return "neutral";
}

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getViewerContext();
  if (!ctx) redirect("/login");

  const target = ctx.roster.agents.find((a) => a.id === id);
  if (!target || target.role === "management") notFound();

  // Strict access control: agents see only themselves; crew leads their team.
  if (!canViewAgent(ctx.viewer, { id: target.id, teamId: target.teamId })) {
    redirect(defaultRouteFor(ctx));
  }

  const team = ctx.roster.agents.filter(
    (a) => a.role !== "management" && a.teamId === target.teamId,
  );
  const teamScored = team.map((a) => a.scored);
  const s = target.scored;
  const canGoBack = ctx.viewer.role !== "agent";

  return (
    <div className="space-y-8">
      <ViewerBar self={ctx.self} role={ctx.viewer.role} />

      {canGoBack && (
        <Link href="/team" className="inline-flex items-center gap-1 text-sm font-semibold text-clear-water hover:underline">
          ← Back to team
        </Link>
      )}

      {/* Agent header */}
      <div className="flex flex-col gap-3 rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-clear-water" style={{ fontFamily: "'Collier', Georgia, serif" }}>
            {target.name}
          </h1>
          <p className="text-sm text-gray-500">
            {target.teamName ?? "Unassigned"}
            {target.role === "crew_lead" ? " · Crew Lead" : ""} · {target.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(s.overallStatus)}>{s.overallStatus}</Badge>
          {s.zilpiEligible && <Badge variant="teal">Zillow Preferred</Badge>}
          {s.flags.flagged && <Badge variant="red">Flagged</Badge>}
          <span className="rounded-full bg-clear-water/10 px-3 py-1 text-xs font-bold text-clear-water">
            Readiness {s.operationalReadiness === null ? "N/A" : Math.round(s.operationalReadiness)}/100
          </span>
        </div>
      </div>

      <AgentScorecard agent={s} team={teamScored} />
    </div>
  );
}
