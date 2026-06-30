import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/server";
import { visibleAgents } from "@/lib/rbac";
import { StatCard } from "@/components/stat-card";
import { TeamScorecard } from "@/components/team-scorecard";
import { ViewerBar } from "@/components/viewer-bar";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await getViewerContext();
  if (!ctx) redirect("/login");
  // Agents have no team view — send them to their own page.
  if (ctx.viewer.role === "agent") redirect(`/agent/${ctx.self.id}`);

  const { viewer, self, roster } = ctx;
  const producing = roster.agents.filter((a) => a.role !== "management");
  const allowed = new Set(
    visibleAgents(viewer, producing.map((a) => ({ id: a.id, teamId: a.teamId }))).map((r) => r.id),
  );
  const visible = producing
    .filter((a) => allowed.has(a.id))
    .sort((a, b) => (b.scored.operationalReadiness ?? 0) - (a.scored.operationalReadiness ?? 0));
  const scored = visible.map((a) => a.scored);

  const title =
    viewer.role === "management" ? "All Agents" : `${self.teamName ?? "My Crew"} — My Team`;

  return (
    <div className="space-y-8">
      <ViewerBar self={self} role={viewer.role} />

      <div>
        <h1 className="text-3xl font-bold text-clear-water" style={{ fontFamily: "'Collier', Georgia, serif" }}>
          {title}
        </h1>
        <p className="mt-1 text-gray-600">
          {visible.length} agent{visible.length === 1 ? "" : "s"} · tap a card for the full scorecard
        </p>
      </div>

      {/* Stat cards — sorted by operational readiness, rank displayed as jersey number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((a, i) => (
          <StatCard key={a.id} agent={a} rank={i + 1} />
        ))}
      </div>

      {/* Team-level scorecard gauges */}
      {scored.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-clear-water" style={{ fontFamily: "'Collier', Georgia, serif" }}>
            Team Zillow Preferred Scorecard
          </h2>
          <TeamScorecard scored={scored} />
        </div>
      )}
    </div>
  );
}
