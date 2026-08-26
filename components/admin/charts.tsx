"use client";

import { useId, useState } from "react";

/**
 * Charts as plain inline SVG.
 *
 * The panel had no charts at all and the project has no charting dependency;
 * adding one (recharts et al) would pull ~150KB for what a few hundred lines of
 * SVG does exactly as well, with full control over the Wheelers palette and no
 * hydration cost. Everything here is deterministic — no layout measurement, so
 * it renders identically on server and client.
 */

const ORANGE = "#FF5C00";
const GREEN = "#00C48C";
const MUTED = "#B9AFA6";
const GRID = "#EFE7DE";
const INK = "#0D0D0D";

function niceCeiling(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const scaled = max / magnitude;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * magnitude;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * Grouped bars over time. Used for rides requested vs completed, where the gap
 * between the two bars *is* the story (the requests that never became trips).
 */
export function BarChart({
  data,
  height = 200,
  series,
  formatValue,
}: {
  data: Array<{ label: string; values: number[] }>;
  height?: number;
  series: Array<{ name: string; color: string }>;
  formatValue?: (n: number) => string;
}) {
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <div className="admin-empty">No data for this period.</div>;
  }

  const width = 800;
  const padL = 48;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxValue = niceCeiling(Math.max(1, ...data.flatMap((d) => d.values)));
  const slot = plotW / data.length;
  const barGap = 2;
  const barW = Math.max(1, (slot - barGap * (series.length + 1)) / series.length);

  const y = (v: number) => padT + plotH - (v / maxValue) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxValue * f);
  const fmt = formatValue ?? ((n: number) => n.toLocaleString("en-NG"));

  // Enough labels to orient, not so many they collide.
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="admin-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="admin-chart-svg" role="img">
        {ticks.map((t, i) => (
          <g key={`${uid}-t${i}`}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill={MUTED}>
              {fmt(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => (
          <g key={`${uid}-b${i}`}>
            {hover === i ? (
              <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill={INK} opacity="0.04" />
            ) : null}
            {d.values.map((v, s) => (
              <rect
                key={s}
                x={padL + i * slot + barGap * (s + 1) + barW * s}
                y={y(v)}
                width={barW}
                height={Math.max(0, padT + plotH - y(v))}
                fill={series[s]?.color ?? ORANGE}
                rx={Math.min(2, barW / 2)}
              />
            ))}
            <rect
              x={padL + i * slot}
              y={padT}
              width={slot}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            {i % labelEvery === 0 ? (
              <text x={padL + i * slot + slot / 2} y={height - 8} textAnchor="middle" fontSize="10" fill={MUTED}>
                {d.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      <div className="admin-chart-legend">
        {series.map((s) => (
          <span key={s.name} className="admin-chart-key">
            <i style={{ background: s.color }} /> {s.name}
          </span>
        ))}
        {hover !== null ? (
          <span className="admin-chart-hover">
            <strong>{data[hover].label}</strong>
            {data[hover].values.map((v, i) => (
              <span key={i}>
                {series[i]?.name}: {fmt(v)}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** A filled line for a single money series — revenue over time. */
export function AreaChart({
  data,
  height = 200,
  color = GREEN,
  formatValue,
}: {
  data: SeriesPoint[];
  height?: number;
  color?: string;
  formatValue?: (n: number) => string;
}) {
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <div className="admin-empty">No data for this period.</div>;
  }

  const width = 800;
  const padL = 56;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxValue = niceCeiling(Math.max(1, ...data.map((d) => d.value)));
  const x = (i: number) => padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxValue) * plotH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${padT + plotH} L${x(0)},${padT + plotH} Z`;
  const ticks = [0, 0.5, 1].map((f) => maxValue * f);
  const fmt = formatValue ?? ((n: number) => n.toLocaleString("en-NG"));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="admin-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="admin-chart-svg" role="img">
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={`${uid}-t${i}`}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill={MUTED}>
              {fmt(t)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${uid}-fill)`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke={INK} strokeOpacity="0.15" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
          </g>
        ) : null}

        {data.map((d, i) => (
          <rect
            key={`${uid}-h${i}`}
            x={x(i) - plotW / data.length / 2}
            y={padT}
            width={plotW / data.length}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={`${uid}-l${i}`} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill={MUTED}>
              {d.label}
            </text>
          ) : null,
        )}
      </svg>

      <div className="admin-chart-legend">
        {hover !== null ? (
          <span className="admin-chart-hover">
            <strong>{data[hover].label}</strong>
            <span>{fmt(data[hover].value)}</span>
          </span>
        ) : (
          <span className="admin-chart-key">
            <i style={{ background: color }} /> Hover for daily values
          </span>
        )}
      </div>
    </div>
  );
}

/** Horizontal bars for a ranked breakdown — cancellation reasons, fee split. */
export function BreakdownBars({
  rows,
  formatValue,
  color = ORANGE,
}: {
  rows: Array<{ label: string; value: number }>;
  formatValue?: (n: number) => string;
  color?: string;
}) {
  if (rows.length === 0) return <div className="admin-empty">Nothing to show.</div>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const fmt = formatValue ?? ((n: number) => n.toLocaleString("en-NG"));

  return (
    <div className="admin-breakdown">
      {rows.map((row) => (
        <div key={row.label} className="admin-breakdown-row">
          <span className="admin-breakdown-label" title={row.label}>
            {row.label}
          </span>
          <span className="admin-breakdown-track">
            <span
              className="admin-breakdown-fill"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, background: color }}
            />
          </span>
          <span className="admin-breakdown-value">{fmt(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

export const CHART_COLORS = { ORANGE, GREEN, MUTED };
