import Link from "next/link";
import type { RosterAgent } from "@/lib/roster";
import { formatMetricValue } from "@/lib/scoring";

/**
 * Agent stat card — a basketball-player-card-style summary adapted to agents.
 * Avatar + name + team, a readiness bar (the "headline stat"), a tier/flag
 * badge, and a row of key metrics. The whole card links to the agent's page.
 */

const TIER_STYLES: Record<string, { label: string; bg: string; fg: string }> = {
  elite: { label: "ELITE", bg: "#12A594", fg: "#fff" },
  boz: { label: "BEST OF ZILLOW", bg: "#30B14A", fg: "#fff" },
  standard: { label: "QUALIFIED", bg: "#E7E0D4", fg: "#5A4632" },
  unranked: { label: "—", bg: "#E7E0D4", fg: "#8A8F94" },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-base font-extrabold text-gray-900 leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}

export function StatCard({ agent }: { agent: RosterAgent }) {
  const s = agent.scored;
  const readiness = s.operationalReadiness;
  const readinessPct = readiness === null ? 0 : Math.min(100, Math.round(readiness));
  const tier = TIER_STYLES[s.tier] ?? TIER_STYLES.unranked;

  const metric = (k: string) => {
    const m = s.metrics[k];
    return m ? formatMetricValue(m.value, m.unit) : "N/A";
  };

  // Bar color by status.
  const barColor =
    s.overallStatus === "Preferred" ? "#30B14A" : s.overallStatus === "At Risk" ? "#F5A300" : "#E5484D";

  return (
    <Link
      href={`/agent/${agent.id}`}
      className="group block overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-center gap-3 bg-gradient-to-br from-clear-water to-[#0a4f52] p-4 text-white">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-extrabold">
          {initials(agent.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-extrabold leading-tight">{agent.name}</div>
          <div className="truncate text-xs text-pearl-aqua">
            {agent.teamName ?? "Unassigned"}
            {agent.role === "crew_lead" ? " · Crew Lead" : ""}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide"
          style={{ background: tier.bg, color: tier.fg }}
        >
          {tier.label}
        </span>
      </div>

      {/* Readiness headline */}
      <div className="px-4 pt-4">
        <div className="mb-1 flex items-end justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Operational readiness</span>
          <span className="text-lg font-extrabold text-gray-900">
            {readiness === null ? "N/A" : readinessPct}
            <span className="text-xs font-bold text-gray-400">/100</span>
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-sandy-shore-mid">
          <div className="h-full rounded-full transition-all" style={{ width: `${readinessPct}%`, background: barColor }} />
        </div>
        {s.flags.flagged && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
            ⚠ Below a Zillow Preferred minimum
          </div>
        )}
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-1 p-4 pt-3">
        <Stat label="pCVR" value={metric("pcvr")} />
        <Stat label="Pickup" value={metric("pickup_rate")} />
        <Stat label="ZHL" value={metric("zhl_preapproval")} />
        <Stat label="Points" value={s.leaderboardPoints.toLocaleString()} />
      </div>

      <div className="px-4 pb-3 text-center text-xs font-semibold text-clear-water opacity-0 transition group-hover:opacity-100">
        View full scorecard →
      </div>
    </Link>
  );
}
