"use client";

import { LeaderboardEntry } from "@/lib/types";
import { Card, CardHeader, CardTitle } from "./ui/card";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  maxDisplay?: number;
}

export function Leaderboard({ entries, maxDisplay = 10 }: LeaderboardProps) {
  const display = entries.slice(0, maxDisplay);
  const maxPoints = display[0]?.points || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <p
          className="text-sm text-gray-500 mt-1"
          style={{ fontFamily: "'Dax Pro', sans-serif" }}
        >
          Activity points: Appts (500) + 2min Convos (100) + Calls (10) +
          Texts (2) + Emails (1)
        </p>
      </CardHeader>
      <div className="space-y-3">
        {display.map((entry) => (
          <div key={entry.agentId} className="flex items-center gap-3">
            <span className="w-8 text-right text-sm font-bold text-clear-water">
              #{entry.rank}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-sm font-medium truncate"
                  style={{ fontFamily: "'Dax Pro', sans-serif" }}
                >
                  {entry.name}
                </span>
                <span className="text-sm font-bold text-clear-water ml-2">
                  {entry.points.toLocaleString()} pts
                </span>
              </div>
              <div className="h-2 bg-sandy-shore-mid rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(entry.points / maxPoints) * 100}%`,
                    background: `linear-gradient(90deg, #046568, #82C8C3)`,
                  }}
                />
              </div>
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                <span>{entry.appointments} appts</span>
                <span>{entry.conversations2min} 2m+</span>
                <span>{entry.callAttempts} calls</span>
                <span>{entry.texts} texts</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
