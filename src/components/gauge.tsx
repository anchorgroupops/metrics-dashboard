"use client";

import { ScoredMetric } from "@/lib/types";

interface GaugeProps {
  metric: ScoredMetric;
  size?: number;
  teamAverage?: number | null;
}

export function Gauge({ metric, size = 200, teamAverage }: GaugeProps) {
  const { value, target, yellowFloor, status, unit, direction, label } = metric;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const radius = size / 2 - 20;
  const strokeWidth = 18;

  // Determine range for the gauge
  let min = 0;
  let max: number;
  if (unit === "percent") {
    max = Math.max(target * 1.5, 1);
  } else if (unit === "seconds") {
    max = Math.max(yellowFloor * 1.5, target * 3, 600);
  } else {
    max = Math.max(target * 2, (value ?? 0) * 1.3, 100);
  }

  function valueToAngle(v: number): number {
    const fraction = Math.min(Math.max((v - min) / (max - min), 0), 1);
    return Math.PI + fraction * Math.PI; // 180 to 360 degrees (semicircle)
  }

  function polarToCartesian(angle: number, r: number): [number, number] {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  function arcPath(startAngle: number, endAngle: number, r: number): string {
    const [sx, sy] = polarToCartesian(startAngle, r);
    const [ex, ey] = polarToCartesian(endAngle, r);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;
  }

  // Zone boundaries
  const targetAngle = valueToAngle(target);
  const yellowAngle = valueToAngle(yellowFloor);
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;

  // For lower_is_better, zones are reversed
  let redStart: number,
    redEnd: number,
    yellowStart: number,
    yellowEnd: number,
    greenStart: number,
    greenEnd: number;
  if (direction === "lower_is_better") {
    greenStart = startAngle;
    greenEnd = targetAngle;
    yellowStart = targetAngle;
    yellowEnd = yellowAngle;
    redStart = yellowAngle;
    redEnd = endAngle;
  } else {
    redStart = startAngle;
    redEnd = yellowAngle;
    yellowStart = yellowAngle;
    yellowEnd = targetAngle;
    greenStart = targetAngle;
    greenEnd = endAngle;
  }

  const needleAngle = value !== null ? valueToAngle(value) : startAngle;
  const teamAngle =
    teamAverage !== null && teamAverage !== undefined
      ? valueToAngle(teamAverage)
      : null;

  const [nx, ny] = polarToCartesian(needleAngle, radius - 8);

  function formatValue(v: number | null): string {
    if (v === null) return "N/A";
    if (unit === "percent") return `${(v * 100).toFixed(1)}%`;
    if (unit === "seconds") {
      if (v < 60) return `${Math.round(v)}s`;
      return `${Math.round(v / 60)}m`;
    }
    return v.toLocaleString();
  }

  const statusColor =
    status === "green"
      ? "#2ECC71"
      : status === "yellow"
        ? "#F0A500"
        : status === "red"
          ? "#E05C4B"
          : "#999";

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size / 2 + 40}
        viewBox={`0 0 ${size} ${size / 2 + 40}`}
      >
        {/* Background arc */}
        <path
          d={arcPath(startAngle, endAngle, radius)}
          fill="none"
          stroke="#E5E5E5"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Red zone */}
        <path
          d={arcPath(redStart, redEnd, radius)}
          fill="none"
          stroke="#E05C4B"
          strokeWidth={strokeWidth}
          opacity={0.3}
          strokeLinecap="round"
        />

        {/* Yellow zone */}
        <path
          d={arcPath(yellowStart, yellowEnd, radius)}
          fill="none"
          stroke="#F0A500"
          strokeWidth={strokeWidth}
          opacity={0.3}
          strokeLinecap="round"
        />

        {/* Green zone */}
        <path
          d={arcPath(greenStart, greenEnd, radius)}
          fill="none"
          stroke="#2ECC71"
          strokeWidth={strokeWidth}
          opacity={0.3}
          strokeLinecap="round"
        />

        {/* Team average marker */}
        {teamAngle !== null &&
          (() => {
            return (
              <line
                x1={cx + (radius - strokeWidth / 2) * Math.cos(teamAngle)}
                y1={cy + (radius - strokeWidth / 2) * Math.sin(teamAngle)}
                x2={cx + (radius + strokeWidth / 2) * Math.cos(teamAngle)}
                y2={cy + (radius + strokeWidth / 2) * Math.sin(teamAngle)}
                stroke="#046568"
                strokeWidth={3}
                opacity={0.6}
              />
            );
          })()}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={statusColor}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={6} fill={statusColor} />

        {/* Value text */}
        <text
          x={cx}
          y={cy + 28}
          textAnchor="middle"
          fill={statusColor}
          fontSize={size > 160 ? 22 : 16}
          fontWeight="bold"
          fontFamily="'Dax Pro', 'Helvetica Neue', Arial, sans-serif"
        >
          {formatValue(value)}
        </text>
      </svg>
      <p
        className="text-sm text-clear-water font-medium -mt-1 text-center"
        style={{ fontFamily: "'Dax Pro', 'Helvetica Neue', Arial, sans-serif" }}
      >
        {label}
      </p>
    </div>
  );
}
