import { buildLeaderboard } from "@/lib/scoring";
import { Leaderboard } from "@/components/leaderboard";
import { getSampleAgents } from "@/lib/sample-data";

export default function LeaderboardPage() {
  const agents = getSampleAgents();
  const leaderboard = buildLeaderboard(agents);

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-clear-water"
          style={{ fontFamily: "'Collier', Georgia, serif" }}
        >
          Activity Leaderboard
        </h1>
        <p className="text-gray-600 mt-1" style={{ fontFamily: "'Dax Pro', sans-serif" }}>
          Ranked by weighted activity points
        </p>
      </div>
      <Leaderboard entries={leaderboard} maxDisplay={25} />
    </div>
  );
}
