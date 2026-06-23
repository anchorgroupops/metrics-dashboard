import {
  scoreAllAgents,
  buildTeamSummary,
  buildLeaderboard,
  computeTeamAverages,
} from "@/lib/scoring";
import { AgentCard } from "@/components/agent-card";
import { Leaderboard } from "@/components/leaderboard";
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
