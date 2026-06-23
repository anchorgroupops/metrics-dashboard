"use client";

/**
 * Performance gauge — the rich, presentation-grade gauge used across the
 * dashboard (ZHL pre-approval, and reusable for any "% of target" metric).
 *
 * Reproduces the approved design: a four-band semicircle scale
 *   red    — below the Zillow Preferred minimum
 *   teal   — meeting the minimum, up to Best of Zillow
 *   green  — Best of Zillow (top 15%)
 *   cyan   — Elite (top 1%)
 * with a needle + value callout, tick labels, top-performer dots (ties merged),
 * zone labels, and the TEAM AVG indicator anchored on the arc.
 *
 * Geometry lives in `@/lib/gauge-geometry` (pure, tested); this file is layout.
 */

import {
  valueToAngle,
  polar,
  arcPath,
  topPerformers,
  formatPercentOfTarget,
  type Performer,
} from "@/lib/gauge-geometry";

interface PerfGaugeProps {
  title?: string;
  subtitle?: string;
  axisLabel?: string;
  value: number; // needle value, in axis units (e.g. 129 = 129% of target)
  valueLabel?: string;
  min?: number;
  max?: number;
  minimumThreshold?: number; // red → teal boundary (Zillow Preferred minimum)
  bozThreshold?: number; // teal → green boundary (Best of Zillow / top 15%)
  eliteThreshold?: number; // green → cyan boundary (Elite / top 1%)
  teamAverage?: number | null;
  performers?: Performer[];
  ticks?: number[];
  width?: number;
}

// Zone colors (from the approved design).
const RED = "#B23A2E";
const TEAL = "#13868C";
const GREEN = "#3FBF3F";
const ELITE = "#1FE0C0";
const NEEDLE = "#0E6E78";
const INK = "#111111";

export function PerfGauge({
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
  width = 1040,
}: PerfGaugeProps) {
  const VB_W = 1160;
  const VB_H = 700;
  const cx = VB_W / 2;
  const cy = 500;
  const radius = 330;
  const sw = 46;
  const ang = (v: number) => valueToAngle(v, min, max);

  const zone = (a: number, b: number, color: string, round: boolean) => (
    <path
      d={arcPath(cx, cy, ang(a), ang(b), radius)}
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap={round ? "round" : "butt"}
    />
  );

  // Needle polygon (slim triangle) + hub.
  const a = ang(value);
  const tip = polar(cx, cy, a, radius - 6);
  const baseL = polar(cx, cy, a + Math.PI / 2, 12);
  const baseR = polar(cx, cy, a - Math.PI / 2, 12);

  // Top performers, ordered top→bottom by where their dot sits on the arc, so
  // callout boxes stack without their leader lines crossing.
  const PERF_LINE_H = 20;
  const tops = topPerformers(performers, 3)
    .map((g) => ({ ...g, dot: polar(cx, cy, ang(g.value), radius) }))
    .sort((p, q) => p.dot.y - q.dot.y);
  // Pre-compute callout box layout immutably (prefix-sum of stacked heights).
  const perfBoxes = tops.map((g, i, arr) => {
    const boxH = 16 + g.names.length * PERF_LINE_H + 22;
    const boxY =
      150 + arr.slice(0, i).reduce((s, p) => s + (16 + p.names.length * PERF_LINE_H + 22) + 22, 0);
    return { g, boxH, boxY };
  });

  const marker = (v: number, color: string, w = 5) => {
    const inner = polar(cx, cy, ang(v), radius - sw / 2 - 4);
    const outer = polar(cx, cy, ang(v), radius + sw / 2 + 4);
    return <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={color} strokeWidth={w} />;
  };

  const valuePt = { x: 280, y: 320 };

  return (
    <svg
      width={width}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ fontFamily: "Arial, 'Helvetica Neue', sans-serif", maxWidth: "100%" }}
    >
      {/* Title */}
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

      {/* Track + four zones */}
      <path d={arcPath(cx, cy, ang(min), ang(max), radius)} fill="none" stroke="#E7E0D4" strokeWidth={sw + 6} strokeLinecap="round" />
      {zone(min, minimumThreshold, RED, true)}
      {zone(minimumThreshold, bozThreshold, TEAL, false)}
      {zone(bozThreshold, eliteThreshold, GREEN, false)}
      {zone(eliteThreshold, max, ELITE, true)}

      {/* Tick labels (just inside the arc) */}
      {ticks.map((t) => {
        const p = polar(cx, cy, ang(t), radius - sw / 2 - 30);
        return (
          <text key={t} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={24} fontWeight="700" fill="#222">
            {formatPercentOfTarget(t)}
          </text>
        );
      })}

      {/* Needle + hub */}
      <polygon points={`${tip.x},${tip.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`} fill={NEEDLE} />
      <circle cx={cx} cy={cy} r={20} fill={NEEDLE} />

      {/* Value callout (left) with connector to the needle tip */}
      <line x1={tip.x} y1={tip.y} x2={valuePt.x} y2={valuePt.y} stroke="#7A6A55" strokeWidth={2} />
      <rect x={120} y={valuePt.y - 30} rx={14} ry={14} width={170} height={58} fill="#D8C7AE" />
      <text x={205} y={valuePt.y + 9} textAnchor="middle" fontSize={34} fontWeight="800" fill="#5A4632">
        {valueLabel ?? formatPercentOfTarget(value)}
      </text>

      {/* Minimum zone label (lower-left) */}
      <rect x={70} y={590} rx={12} ry={12} width={108} height={50} fill={RED} />
      <text x={124} y={624} textAnchor="middle" fontSize={26} fontWeight="800" fill="#fff">
        {formatPercentOfTarget(minimumThreshold)}
      </text>
      <text x={70} y={664} fontSize={17} fontWeight="700" fill="#444">
        Zillow Preferred Minimum (Below Minimums)
      </text>

      {/* Best of Zillow label (lower-right, under the green band) */}
      <text x={VB_W - 70} y={604} textAnchor="end" fontSize={26} fontWeight="800" fill={INK}>
        BEST OF ZILLOW
      </text>
      <text x={VB_W - 70} y={628} textAnchor="end" fontSize={16} fill="#444">
        Top 15% of Zillow Preferred
      </text>

      {/* Elite label (bottom-right) */}
      <rect x={VB_W - 220} y={644} rx={12} ry={12} width={160} height={50} fill={ELITE} />
      <text x={VB_W - 140} y={668} textAnchor="middle" fontSize={22} fontWeight="800" fill="#064">
        ELITE
      </text>
      <text x={VB_W - 140} y={686} textAnchor="middle" fontSize={13} fill="#064">
        Top 1% of Zillow Preferred
      </text>

      {/* Top-performer dots + name callouts (ties merged, names wrapped) */}
      {perfBoxes.map(({ g, boxH, boxY }) => {
        const boxX = VB_W - 268;
        const boxW = 250;
        return (
          <g key={g.value}>
            <line x1={g.dot.x} y1={g.dot.y} x2={boxX} y2={boxY + boxH / 2} stroke="#888" strokeWidth={2} />
            <circle cx={g.dot.x} cy={g.dot.y} r={11} fill="#BEE9F2" stroke="#0E6E78" strokeWidth={3} />
            <rect x={boxX} y={boxY} rx={12} ry={12} width={boxW} height={boxH} fill={INK} />
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

      {/* TEAM AVG indicator on the arc (the previously-missing piece) */}
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

      {/* Axis label */}
      <text x={cx} y={VB_H - 6} textAnchor="middle" fontSize={22} fontWeight="600" fill="#222">
        {axisLabel}
      </text>
    </svg>
  );
}
