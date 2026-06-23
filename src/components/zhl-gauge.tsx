"use client";

/**
 * ZHL (Zillow Home Loans) pre-approval progress gauge.
 *
 * Progress toward the 100% pre-approval goal, drawn in the same semicircle SVG
 * language as the metric `Gauge` (brand teal fill, light track, value below) so
 * it sits consistently in the agent card. Adds quarter milestone ticks and an
 * optional team-average marker. Target defaults to 1.0 (100%).
 */

import { BRAND } from "@/lib/brand";

interface ZhlGaugeProps {
  value: number | null; // decimal 0-1 progress
  target?: number; // decimal goal, default 1.0
  size?: number;
  teamAverage?: number | null;
  label?: string;
}

export function ZhlGauge({
  value,
  target = 1.0,
  size = 200,
  teamAverage = null,
  label = "ZHL Pre-Approval",
}: ZhlGaugeProps) {
  const cx = size / 2;
  const cy = size / 2 + 10;
  const radius = size / 2 - 20;
  const strokeWidth = 18;
  const start = Math.PI;
  const end = 2 * Math.PI;

  const frac = value === null ? 0 : Math.min(Math.max(value / target, 0), 1);
  const reached = value !== null && value >= target;

  const angleFor = (f: number) => start + Math.min(Math.max(f, 0), 1) * Math.PI;
  const polar = (angle: number, r: number): [number, number] => [
    cx + r * Math.cos(angle),
    cy + r * Math.sin(angle),
  ];
  const arc = (a0: number, a1: number, r: number): string => {
    const [sx, sy] = polar(a0, r);
    const [ex, ey] = polar(a1, r);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
  };

  const progressColor = reached ? BRAND.color_green : BRAND.color_primary;
  const teamAngle = teamAverage !== null ? angleFor(teamAverage / target) : null;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 40} viewBox={`0 0 ${size} ${size / 2 + 40}`}>
        <defs>
          <linearGradient id="zhl-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={BRAND.color_primary} />
            <stop offset="100%" stopColor={BRAND.color_secondary} />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={arc(start, end, radius)}
          fill="none"
          stroke="#E5E5E5"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Progress fill */}
        {frac > 0 && (
          <path
            d={arc(start, angleFor(frac), radius)}
            fill="none"
            stroke={reached ? progressColor : "url(#zhl-grad)"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        {/* Quarter milestone ticks */}
        {[0.25, 0.5, 0.75].map((t) => {
          const a = angleFor(t);
          const [x1, y1] = polar(a, radius - strokeWidth / 2);
          const [x2, y2] = polar(a, radius + strokeWidth / 2);
          return (
            <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFFFFF" strokeWidth={2} opacity={0.7} />
          );
        })}

        {/* Team-average marker */}
        {teamAngle !== null && (
          <line
            x1={cx + (radius - strokeWidth / 2) * Math.cos(teamAngle)}
            y1={cy + (radius - strokeWidth / 2) * Math.sin(teamAngle)}
            x2={cx + (radius + strokeWidth / 2) * Math.cos(teamAngle)}
            y2={cy + (radius + strokeWidth / 2) * Math.sin(teamAngle)}
            stroke={BRAND.color_text}
            strokeWidth={3}
            opacity={0.5}
          />
        )}

        {/* Value */}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill={progressColor}
          fontSize={size > 160 ? 26 : 18}
          fontWeight="bold"
          fontFamily={BRAND.font_body}
        >
          {value === null ? "N/A" : `${Math.round(value * 100)}%`}
        </text>
        <text
          x={cx}
          y={cy + 24}
          textAnchor="middle"
          fill="#999"
          fontSize={11}
          fontFamily={BRAND.font_body}
        >
          of {Math.round(target * 100)}% goal
        </text>
      </svg>
      <p
        className="text-sm font-medium -mt-1 text-center"
        style={{ color: BRAND.color_primary, fontFamily: BRAND.font_body }}
      >
        {label}
      </p>
    </div>
  );
}
