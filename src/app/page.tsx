import {
  scoreAllAgents,
  buildTeamSummary,
  buildLeaderboard,
  computeTeamAverages,
} from "@/lib/scoring";
import { AgentCard } from "@/components/agent-card";
import { Leaderboard } from "@/components/leaderboard";
import { PerfGauge } from "@/components/perf-gauge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSampleAgents } from "@/lib/sample-data";

export default function DashboardPage() {
  const agents = getSampleAgents();
  const scored = scoreAllAgents(agents);
  const period = agents[0]?.period || "2026-06";
  const summary = buildTeamSummary(scored, period);
  const leaderboard = buildLeaderboard(agents);
  const teamAverages = computeTeamAverages(scored);

  // Team ZHL pre-approval gauge (value = percentage of target, 0-300%).
  const zhlPerformers = scored
    .map((a) => ({ name: a.name, v: a.metrics.zhl_preapproval?.value ?? null }))
    .filter((p): p is { name: string; v: number } => p.v !== null)
    .map((p) => ({ name: p.name, value: Math.round(p.v * 100) }));
  const teamZhl = zhlPerformers.length
    ? Math.round(zhlPerformers.reduce((s, p) => s + p.value, 0) / zhlPerformers.length)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-clear-water"
            style={{ fontFamily: "'Collier', Georgia, serif" }}
          >
            Performance Dashboard
          </h1>
          <p className="text-gray-600 mt-1" style={{ fontFamily: "'Dax Pro', sans-serif" }}>
            Zillow Preferred metrics for {formatPeriod(period)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {summary.eliteCount > 0 && (
            <Badge variant="teal">{summary.eliteCount} Elite · Top 1%</Badge>
          )}
          <Badge variant="green">{summary.bozCount} BOZ · Top 15%</Badge>
          {summary.flaggedCount > 0 && (
            <Badge variant="red">{summary.flaggedCount} Flagged</Badge>
          )}
          <Badge variant="neutral">{scored.length} Agents</Badge>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Team Avg Readiness" value={`${summary.averageReadiness.toFixed(0)}/100`} />
        <SummaryCard label="BOZ / Elite" value={`${summary.bozCount} / ${summary.eliteCount}`} />
        <SummaryCard label="Zillow Preferred" value={`${summary.zilpiEligibleCount}/${scored.length}`} />
        <SummaryCard label="Top Performer" value={scored[0]?.name || "N/A"} />
      </div>

      {/* Team ZHL pre-approval performance gauge */}
      {zhlPerformers.length > 0 && (
        <Card className="flex justify-center overflow-x-auto">
          <PerfGauge
            title="TEAM ZHL PRE-APPROVAL PERFORMANCE"
            subtitle="15% of the overall Zillow Preferred score"
            axisLabel="ZHL Pre-approvals (percentage of target)"
            value={teamZhl}
            teamAverage={teamZhl}
            minimumThreshold={100}
            bozThreshold={200}
            eliteThreshold={280}
            performers={zhlPerformers}
          />
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leaderboard */}
        <div className="lg:col-span-1">
          <Leaderboard entries={leaderboard} maxDisplay={10} />
        </div>

        {/* Agent cards */}
        <div className="lg:col-span-2 space-y-6">
          {scored.map((agent) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              teamAverages={teamAverages}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="text-center">
      <p className="text-sm text-gray-500 mb-1" style={{ fontFamily: "'Dax Pro', sans-serif" }}>{label}</p>
      <p className="text-2xl font-bold text-clear-water" style={{ fontFamily: "'Collier', Georgia, serif" }}>{value}</p>
    </Card>
  );
}

function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${monthNames[parseInt(month, 10)] || month} ${year}`;
}
