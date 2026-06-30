"use client";

/**
 * PerfGauge — a clean, modern semicircle dial for a single Zillow Preferred
 * metric. Segmented rounded arcs with the "below standard" red band occupying
 * only the bottom 10%, then qualified (amber) → milestone (green) → elite
 * (teal). Shows the agent/team needle, the minimum line, a labeled milestone
 * pointer, a team-average marker, and top-performer dots, with the value in the
 * center. Geometry is from `@/lib/gauge-geometry`.
 */

import { valueToAngle, polar, arcPath, topPerformers, type Performer } from "@/lib/gauge-geometry";

export interface PerfGaugeProps {
  value: number; // needle, axis units (% of target)
  valueLabel?: string; // natural-unit label shown in the center
  unitLabel?: string; // small caption under the value (e.g. metric short name)
  min?: number;
  max?: number;
  minimumThreshold?: number; // default 100
  milestone?: number | null;
  milestoneLabel?: string | null;
  milestoneValueLabel?: string | null;
  teamAverage?: number | null;
  performers?: Performer[];
  width?: number;
}

// Refined palette.
const RED = "#E5484D";
const AMBER = "#F5A300";
const GREEN = "#30B14A";
const NEEDLE = "#2A2F33";
const INK = "#1A1A1A";
const MUTE = "#8A8F94";

export function PerfGauge({
  value,
  valueLabel,
  unitLabel,
  min = 0,
  max = 300,
  minimumThreshold = 100,
  milestone = null,
  milestoneLabel = null,
  milestoneValueLabel = null,
  teamAverage = null,
  performers = [],
  width = 420,
}: PerfGaugeProps) {
  const VB_W = 460;
  const VB_H = 320;
  const cx = VB_W / 2;
  const cy = 250;
  const R = 184;
  const SW = 22;
  const ang = (v: number) => valueToAngle(v, min, max);
  const GAP = 0.022; // angular gap between segments (rad)

  // Build colored segments bottom→top: red (below standard) → amber (qualified)
  // → green (milestone and beyond).
  const mStart = milestone != null && milestone > minimumThreshold ? milestone : minimumThreshold;
  const rawSegs: Array<[number, number, string, string]> = [
    [min, minimumThreshold, RED, "r"],
    [minimumThreshold, mStart, AMBER, "a"],
    [mStart, max, GREEN, "g"],
  ];
  const segs = rawSegs.filter(([a, b]) => b - a > 0.5);

  // Needle.
  const a = ang(value);
  const tip = polar(cx, cy, a, R - 2);
  const bL = polar(cx, cy, a + Math.PI / 2, 9);
  const bR = polar(cx, cy, a - Math.PI / 2, 9);

  const tops = topPerformers(performers, 3);

  const tick = (v: number, color: string, w: number, over = 6, under = 6) => {
    const inner = polar(cx, cy, ang(v), R - SW / 2 - under);
    const outer = polar(cx, cy, ang(v), R + SW / 2 + over);
    return <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={color} strokeWidth={w} strokeLinecap="round" />;
  };

  // Milestone pointer (outside the arc): triangle aimed at the band + label.
  const milestoneNode = (() => {
    if (milestone == null) return null;
    const p = polar(cx, cy, ang(milestone), R + SW / 2 + 4);
    const onRight = p.x >= cx;
    const tx = onRight ? p.x + 14 : p.x - 14;
    const tri = onRight
      ? `${p.x + 6},${p.y} ${p.x + 16},${p.y - 7} ${p.x + 16},${p.y + 7}`
      : `${p.x - 6},${p.y} ${p.x - 16},${p.y - 7} ${p.x - 16},${p.y + 7}`;
    return (
      <g>
        <polygon points={tri} fill={INK} />
        <text
          x={tx}
          y={p.y - 2}
          textAnchor={onRight ? "start" : "end"}
          fontSize={15}
          fontWeight={800}
          fill={INK}
        >
          {milestoneLabel ?? "Goal"}
        </text>
        {milestoneValueLabel && (
          <text x={tx} y={p.y + 14} textAnchor={onRight ? "start" : "end"} fontSize={13} fill={MUTE}>
            {milestoneValueLabel}
          </text>
        )}
      </g>
    );
  })();

  return (
    <svg
      width={width}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ fontFamily: "ui-sans-serif, system-ui, Arial, sans-serif", maxWidth: "100%", overflow: "visible" }}
    >
      <defs>
        {segs.map(([, , color, id]) => (
          <linearGradient key={id} id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.95} />
            <stop offset="100%" stopColor={color} stopOpacity={0.7} />
          </linearGradient>
        ))}
      </defs>

      {/* Faint full track */}
      <path d={arcPath(cx, cy, ang(min), ang(max), R)} fill="none" stroke="#EFEAE2" strokeWidth={SW + 4} strokeLinecap="round" />

      {/* Colored segments with gaps + rounded caps */}
      {segs.map(([a0, a1, , id], i) => {
        const start = ang(a0) + (i === 0 ? 0 : GAP / 2);
        const end = ang(a1) - (i === segs.length - 1 ? 0 : GAP / 2);
        if (end <= start) return null;
        return (
          <path key={id} d={arcPath(cx, cy, start, end, R)} fill="none" stroke={`url(#g-${id})`} strokeWidth={SW} strokeLinecap="round" />
        );
      })}

      {/* Minimum (standard) tick */}
      {tick(minimumThreshold, "#FFFFFF", 3, 0, 0)}

      {/* Top-performer dots */}
      {tops.map((g) => {
        const dot = polar(cx, cy, ang(g.value), R);
        return <circle key={g.value} cx={dot.x} cy={dot.y} r={6.5} fill="#FFFFFF" stroke={INK} strokeWidth={2} />;
      })}

      {/* Team-average marker */}
      {teamAverage !== null && (
        <g>
          {tick(teamAverage, INK, 4)}
          {(() => {
            const p = polar(cx, cy, ang(teamAverage), R + SW / 2 + 22);
            return (
              <text x={p.x} y={p.y} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK}>
                TEAM
              </text>
            );
          })()}
        </g>
      )}

      {/* Milestone pointer */}
      {milestoneNode}

      {/* Needle + hub */}
      <polygon points={`${tip.x},${tip.y} ${bL.x},${bL.y} ${bR.x},${bR.y}`} fill={NEEDLE} />
      <circle cx={cx} cy={cy} r={13} fill="#FFFFFF" stroke={NEEDLE} strokeWidth={4} />

      {/* Value, below the hub where the needle never points */}
      <text x={cx} y={cy + 42} textAnchor="middle" fontSize={42} fontWeight={800} fill={INK}>
        {valueLabel ?? `${Math.round(value)}%`}
      </text>
      {unitLabel && (
        <text x={cx} y={cy + 62} textAnchor="middle" fontSize={14} fontWeight={600} fill={MUTE}>
          {unitLabel}
        </text>
      )}
    </svg>
  );
}
