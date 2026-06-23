"use client";

/**
 * Performance gauge — presentation-grade four-band semicircle used for every
 * Zillow Preferred metric.
 *
 *   red    — below the Zillow Preferred minimum (100% of target)
 *   teal   — meeting the minimum, up to Best of Zillow
 *   green  — Best of Zillow (top 15%)
 *   cyan   — Elite (top 1%)
 *
 * Two variants share the same arc/needle/zones/markers:
 *   • "full"    — hero metric / team gauge: title, value callout, tick labels,
 *                 zone descriptions, per-performer name callouts, TEAM AVG pill.
 *   • "compact" — secondary/supplementary metrics: title, needle, value, team
 *                 marker, top-performer dots, and a Min/BOZ/Elite legend, with a
 *                 compact top-performer caption instead of large callout boxes.
 *
 * All inputs are in axis units (percentage of target); `@/lib/gauge-model`
 * normalizes a metric into these. Geometry lives in `@/lib/gauge-geometry`.
 */

import {
  valueToAngle,
  polar,
  arcPath,
  topPerformers,
  formatPercentOfTarget,
  type Performer,
} from "@/lib/gauge-geometry";

export interface PerfGaugeProps {
  variant?: "full" | "compact";
  title?: string;
  subtitle?: string;
  axisLabel?: string;
  value: number; // needle value, axis units (% of target)
  valueLabel?: string; // natural-unit label shown in the callout
  min?: number;
  max?: number;
  minimumThreshold?: number; // red → teal (default 100)
  bozThreshold?: number; // teal → green
  eliteThreshold?: number; // green → cyan
  teamAverage?: number | null;
  performers?: Performer[];
  ticks?: number[];
  width?: number;
}

const RED = "#B23A2E";
const TEAL = "#13868C";
const GREEN = "#3FBF3F";
const ELITE = "#1FE0C0";
const NEEDLE = "#0E6E78";
const INK = "#111111";

export function PerfGauge(props: PerfGaugeProps) {
  return props.variant === "compact" ? <CompactGauge {...props} /> : <FullGauge {...props} />;
}

// ── Full (hero / team) ────────────────────────────────────────────────────────

function FullGauge({
  title,
  subtitle,
  axisLabel = "Percentage of target",
  value,
  valueLabel,
  min = 0,
  max = 300,
  minimumThreshold = 100,
  bozThreshold = 200,
  eliteThreshold = 280,
  teamAverage = null,
  performers = [],
  ticks = [0, 150, 200, 250, 300],
  width = 960,
}: PerfGaugeProps) {
  const VB_W = 1160;
  const VB_H = 700;
  const cx = VB_W / 2;
  const cy = 500;
  const radius = 330;
  const sw = 46;
  const ang = (v: number) => valueToAngle(v, min, max);

  const a = ang(value);
  const tip = polar(cx, cy, a, radius - 6);
  const baseL = polar(cx, cy, a + Math.PI / 2, 12);
  const baseR = polar(cx, cy, a - Math.PI / 2, 12);

  const PERF_LINE_H = 20;
  const tops = topPerformers(performers, 3)
    .map((g) => ({ ...g, dot: polar(cx, cy, ang(g.value), radius) }))
    .sort((p, q) => p.dot.y - q.dot.y);
  const perfBoxes = tops.map((g, i, arr) => {
    const boxH = 16 + g.names.length * PERF_LINE_H + 22;
    const boxY = 150 + arr.slice(0, i).reduce((s, p) => s + (16 + p.names.length * PERF_LINE_H + 22) + 22, 0);
    return { g, boxH, boxY };
  });

  const marker = (v: number, color: string, w = 5) => {
    const inner = polar(cx, cy, ang(v), radius - sw / 2 - 4);
    const outer = polar(cx, cy, ang(v), radius + sw / 2 + 4);
    return <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={color} strokeWidth={w} />;
  };
  const valuePt = { x: 280, y: 320 };

  return (
    <svg width={width} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ fontFamily: "Arial, sans-serif", maxWidth: "100%" }}>
      {title && (
        <text x={cx} y={66} textAnchor="middle" fontSize={44} fontWeight="800" fill={INK}>
          {title}
        </text>
      )}
      {subtitle && (
        <text x={cx} y={104} textAnchor="middle" fontSize={25} fill="#333">
          {subtitle}
        </text>
      )}

      <path d={arcPath(cx, cy, ang(min), ang(max), radius)} fill="none" stroke="#E7E0D4" strokeWidth={sw + 6} strokeLinecap="round" />
      <Zone cx={cx} cy={cy} r={radius} sw={sw} a0={ang(min)} a1={ang(minimumThreshold)} color={RED} round />
      <Zone cx={cx} cy={cy} r={radius} sw={sw} a0={ang(minimumThreshold)} a1={ang(bozThreshold)} color={TEAL} />
      <Zone cx={cx} cy={cy} r={radius} sw={sw} a0={ang(bozThreshold)} a1={ang(eliteThreshold)} color={GREEN} />
      <Zone cx={cx} cy={cy} r={radius} sw={sw} a0={ang(eliteThreshold)} a1={ang(max)} color={ELITE} round />

      {ticks.map((t) => {
        const p = polar(cx, cy, ang(t), radius - sw / 2 - 30);
        return (
          <text key={t} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={24} fontWeight="700" fill="#222">
            {formatPercentOfTarget(t)}
          </text>
        );
      })}

      <polygon points={`${tip.x},${tip.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`} fill={NEEDLE} />
      <circle cx={cx} cy={cy} r={20} fill={NEEDLE} />

      {/* Value callout */}
      <line x1={tip.x} y1={tip.y} x2={valuePt.x} y2={valuePt.y} stroke="#7A6A55" strokeWidth={2} />
      <rect x={110} y={valuePt.y - 32} rx={14} ry={14} width={190} height={62} fill="#D8C7AE" />
      <text x={205} y={valuePt.y + 9} textAnchor="middle" fontSize={32} fontWeight="800" fill="#5A4632">
        {valueLabel ?? formatPercentOfTarget(value)}
      </text>

      {/* Minimum zone label */}
      <rect x={70} y={590} rx={12} ry={12} width={108} height={50} fill={RED} />
      <text x={124} y={624} textAnchor="middle" fontSize={26} fontWeight="800" fill="#fff">
        {formatPercentOfTarget(minimumThreshold)}
      </text>
      <text x={70} y={664} fontSize={17} fontWeight="700" fill="#444">
        Zillow Preferred Minimum (Below Minimums)
      </text>

      <text x={VB_W - 70} y={604} textAnchor="end" fontSize={26} fontWeight="800" fill={INK}>
        BEST OF ZILLOW
      </text>
      <text x={VB_W - 70} y={628} textAnchor="end" fontSize={16} fill="#444">
        Top 15% of Zillow Preferred
      </text>

      <rect x={VB_W - 220} y={644} rx={12} ry={12} width={160} height={50} fill={ELITE} />
      <text x={VB_W - 140} y={668} textAnchor="middle" fontSize={22} fontWeight="800" fill="#064">
        ELITE
      </text>
      <text x={VB_W - 140} y={686} textAnchor="middle" fontSize={13} fill="#064">
        Top 1% of Zillow Preferred
      </text>

      {/* Top-performer dots + callouts */}
      {perfBoxes.map(({ g, boxH, boxY }) => {
        const boxX = VB_W - 268;
        return (
          <g key={g.value}>
            <line x1={g.dot.x} y1={g.dot.y} x2={boxX} y2={boxY + boxH / 2} stroke="#888" strokeWidth={2} />
            <circle cx={g.dot.x} cy={g.dot.y} r={11} fill="#BEE9F2" stroke="#0E6E78" strokeWidth={3} />
            <rect x={boxX} y={boxY} rx={12} ry={12} width={250} height={boxH} fill={INK} />
            {g.names.map((name, j) => (
              <text key={name} x={boxX + 16} y={boxY + 26 + j * PERF_LINE_H} fontSize={16} fontWeight="700" fill="#fff">
                {name}
              </text>
            ))}
            <text x={boxX + 16} y={boxY + 26 + g.names.length * PERF_LINE_H} fontSize={14} fill="#9fe3ff">
              {g.names.length > 1 ? `Tied at ${formatPercentOfTarget(g.value)}` : formatPercentOfTarget(g.value)}
            </text>
          </g>
        );
      })}

      {/* TEAM AVG indicator on the arc */}
      {teamAverage !== null &&
        (() => {
          const onArc = polar(cx, cy, ang(teamAverage), radius);
          const pill = polar(cx, cy, ang(teamAverage), radius - sw - 70);
          return (
            <g>
              {marker(teamAverage, INK, 5)}
              <line x1={onArc.x} y1={onArc.y} x2={pill.x} y2={pill.y} stroke={INK} strokeWidth={2} strokeDasharray="4 3" />
              <rect x={pill.x - 95} y={pill.y - 22} rx={16} ry={16} width={190} height={44} fill={INK} />
              <text x={pill.x} y={pill.y + 6} textAnchor="middle" fontSize={22} fontWeight="800" fill="#fff">
                TEAM AVG {formatPercentOfTarget(teamAverage)}
              </text>
            </g>
          );
        })()}

      <text x={cx} y={VB_H - 6} textAnchor="middle" fontSize={22} fontWeight="600" fill="#222">
        {axisLabel}
      </text>
    </svg>
  );
}

// ── Compact (secondary / supplementary) ───────────────────────────────────────

function CompactGauge({
  title,
  value,
  valueLabel,
  min = 0,
  max = 300,
  minimumThreshold = 100,
  bozThreshold = 200,
  eliteThreshold = 280,
  teamAverage = null,
  performers = [],
  ticks,
  width = 420,
}: PerfGaugeProps) {
  const VB_W = 600;
  const VB_H = 540;
  const cx = VB_W / 2;
  const cy = 320;
  const radius = 215;
  const sw = 34;
  const ang = (v: number) => valueToAngle(v, min, max);

  const a = ang(value);
  const tip = polar(cx, cy, a, radius - 4);
  const baseL = polar(cx, cy, a + Math.PI / 2, 9);
  const baseR = polar(cx, cy, a - Math.PI / 2, 9);

  const tops = topPerformers(performers, 3);
  const top = tops[0];
  // Few, well-spaced ticks (zone colors + legend carry BOZ/Elite).
  void ticks;
  void bozThreshold;
  const tickVals = Array.from(new Set([minimumThreshold, eliteThreshold, Math.round(max)]));

  const marker = (v: number, color: string, w = 4) => {
    const inner = polar(cx, cy, ang(v), radius - sw / 2 - 3);
    const outer = polar(cx, cy, ang(v), radius + sw / 2 + 3);
    return <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={color} strokeWidth={w} />;
  };

  return (
    <svg width={width} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ fontFamily: "Arial, sans-serif", maxWidth: "100%" }}>
      {title && (
        <text x={cx} y={34} textAnchor="middle" fontSize={26} fontWeight="800" fill={INK}>
          {title}
        </text>
      )}

      <path d={arcPath(cx, cy, ang(min), ang(max), radius)} fill="none" stroke="#E7E0D4" strokeWidth={sw + 5} strokeLinecap="round" />
      <Zone cx={cx} cy={cy} r={radius} sw={sw} a0={ang(min)} a1={ang(minimumThreshold)} color={RED} round />
      <Zone cx={cx} cy={cy} r={radius} sw={sw} a0={ang(minimumThreshold)} a1={ang(bozThreshold)} color={TEAL} />
      <Zone cx={cx} cy={cy} r={radius} sw={sw} a0={ang(bozThreshold)} a1={ang(eliteThreshold)} color={GREEN} />
      <Zone cx={cx} cy={cy} r={radius} sw={sw} a0={ang(eliteThreshold)} a1={ang(max)} color={ELITE} round />

      {tickVals.map((t) => {
        const p = polar(cx, cy, ang(t), radius - sw / 2 - 20);
        return (
          <text key={t} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={16} fontWeight="700" fill="#333">
            {formatPercentOfTarget(t)}
          </text>
        );
      })}

      {/* Team-average marker + label */}
      {teamAverage !== null && (
        <g>
          {marker(teamAverage, INK, 4)}
          {(() => {
            const p = polar(cx, cy, ang(teamAverage), radius + sw / 2 + 20);
            return (
              <text x={p.x} y={p.y} textAnchor="middle" fontSize={13} fontWeight="700" fill={INK}>
                TEAM {formatPercentOfTarget(teamAverage)}
              </text>
            );
          })()}
        </g>
      )}

      {/* Top-performer dots */}
      {tops.map((g) => {
        const dot = polar(cx, cy, ang(g.value), radius);
        return <circle key={g.value} cx={dot.x} cy={dot.y} r={8} fill="#BEE9F2" stroke="#0E6E78" strokeWidth={2.5} />;
      })}

      {/* Needle + hub */}
      <polygon points={`${tip.x},${tip.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`} fill={NEEDLE} />
      <circle cx={cx} cy={cy} r={14} fill={NEEDLE} />

      {/* Value (below the hub, in the open area) */}
      <text x={cx} y={cy + 64} textAnchor="middle" fontSize={34} fontWeight="800" fill={NEEDLE}>
        {valueLabel ?? formatPercentOfTarget(value)}
      </text>
      <text x={cx} y={cy + 86} textAnchor="middle" fontSize={14} fill="#666">
        agent value
      </text>

      {/* Legend: zones */}
      {[
        { c: RED, t: "Below min" },
        { c: TEAL, t: "Qualified" },
        { c: GREEN, t: "BOZ" },
        { c: ELITE, t: "Elite" },
      ].map((l, i) => (
        <g key={l.t}>
          <rect x={44 + i * 138} y={VB_H - 78} width={16} height={16} rx={3} fill={l.c} />
          <text x={66 + i * 138} y={VB_H - 65} fontSize={14} fill="#333">
            {l.t}
          </text>
        </g>
      ))}

      {/* Top-performer caption */}
      {top && (
        <text x={cx} y={VB_H - 30} textAnchor="middle" fontSize={15} fontWeight="600" fill={INK}>
          {`Top: ${top.names.join(", ")} (${formatPercentOfTarget(top.value)})`}
        </text>
      )}
    </svg>
  );
}

function Zone({
  cx,
  cy,
  r,
  sw,
  a0,
  a1,
  color,
  round = false,
}: {
  cx: number;
  cy: number;
  r: number;
  sw: number;
  a0: number;
  a1: number;
  color: string;
  round?: boolean;
}) {
  if (a1 <= a0) return null;
  return (
    <path
      d={arcPath(cx, cy, a0, a1, r)}
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap={round ? "round" : "butt"}
    />
  );
}
