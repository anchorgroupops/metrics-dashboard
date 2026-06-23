import type { RosterAgent } from "@/lib/roster";
import type { Role } from "@/lib/rbac";

const ROLE_LABEL: Record<Role, string> = {
  management: "Management",
  crew_lead: "Crew Lead",
  agent: "Agent",
};

export function ViewerBar({ self, role }: { self: RosterAgent; role: Role }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-2 text-sm text-gray-600">
      <span>
        Signed in as <span className="font-bold text-gray-900">{self.name}</span> · {ROLE_LABEL[role]}
      </span>
      <form method="post" action="/api/auth/logout">
        <button type="submit" className="font-semibold text-clear-water hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
