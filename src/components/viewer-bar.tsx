import Link from "next/link";
import type { RosterAgent } from "@/lib/roster";
import type { Role } from "@/lib/rbac";

const ROLE_LABEL: Record<Role, string> = {
  management: "Management",
  crew_lead: "Crew Lead",
  agent: "Agent",
};

/**
 * Compact, mobile-first identity + nav bar. Shows who is signed in and links
 * between the viewer's own scorecard and (for management/crew leads) the team
 * view. Sign-out is a plain form post so it works without JS.
 */
export function ViewerBar({ self, role }: { self: RosterAgent; role: Role }) {
  const hasMetrics = self.scored.overallStatus !== "No Data";
  const canSeeTeam = role === "management" || role === "crew_lead";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-white/70 px-4 py-2 text-sm text-gray-600">
      <span className="min-w-0 truncate">
        <span className="font-bold text-gray-900">{self.name}</span>
        <span className="text-gray-400"> · {ROLE_LABEL[role]}</span>
      </span>
      <nav className="flex items-center gap-4">
        {hasMetrics && (
          <Link href={`/agent/${self.id}`} className="font-semibold text-clear-water hover:underline">
            My scorecard
          </Link>
        )}
        {canSeeTeam && (
          <Link href="/team" className="font-semibold text-clear-water hover:underline">
            Team
          </Link>
        )}
        <form method="post" action="/api/auth/logout">
          <button type="submit" className="font-semibold text-gray-400 hover:text-gray-700">
            Sign out
          </button>
        </form>
      </nav>
    </div>
  );
}
