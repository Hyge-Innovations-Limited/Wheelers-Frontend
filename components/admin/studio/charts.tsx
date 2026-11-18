"use client";

/**
 * The Studio's charts, on ECharts (loaded in the browser only). Each builder takes plain rows and returns the chart;
 * a click hands back the category (or series) clicked, which the page turns into a cross-filter pick. A selected
 * category stays full colour and the rest fade, so the active filter is visible on the chart itself.
 */
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);

export const STUDIO_COLORS = {
  blue: "#3D7DD8",
  barLight: "#5B8FDE",
  orange: "#E8773E",
  green: "#52B596",
  gold: "#E5A73A",
  pink: "#E284B0",
  darkGreen: "#3B8A2E",
  purple: "#6A4CD6",
  red: "#D9534F",
  muted: "#8A8A85",
  grid: "#ECECE8",
  ink: "#262624",
};
/** Fixed order: an outcome or a status keeps its colour on every chart. */
export const CATEGORY_ORDER = [STUDIO_COLORS.blue, STUDIO_COLORS.orange, STUDIO_COLORS.green, STUDIO_COLORS.gold, STUDIO_COLORS.pink, STUDIO_COLORS.darkGreen, STUDIO_COLORS.purple, STUDIO_COLORS.red];

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
const AXIS = { color: STUDIO_COLORS.muted, fontSize: 12, fontFamily: FONT };
const FADED = 0.3;
/** Category labels that would run into each other wrap onto two lines instead. */
const WRAP = { width: 62, overflow: "break" as const, lineHeight: 14 };

type Option = echarts.EChartsCoreOption;
export type ChartClick = { name: string; seriesName?: string };

export function EChart({ option, height = 300, onClick }: { option: Option; height?: number; onClick?: (click: ChartClick) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const clickRef = useRef(onClick);
  useEffect(() => { clickRef.current = onClick; }, [onClick]);
  useEffect(() => {
    if (!box.current) return;
    const c = echarts.init(box.current, undefined, { renderer: "canvas" });
    chart.current = c;
    c.on("click", (p) => {
      const params = p as { name?: string; seriesName?: string };
      if (params.name) clickRef.current?.({ name: params.name, seriesName: params.seriesName });
    });
    const resize = new ResizeObserver(() => c.resize());
    resize.observe(box.current);
    return () => { resize.disconnect(); c.dispose(); chart.current = null; };
  }, []);
  useEffect(() => { chart.current?.setOption(option, { notMerge: true }); }, [option]);
  return <div ref={box} style={{ width: "100%", height, cursor: onClick ? "pointer" : "default" }} />;
}

const tooltipBase = { backgroundColor: "#fff", borderColor: STUDIO_COLORS.grid, textStyle: { color: STUDIO_COLORS.ink, fontFamily: FONT, fontSize: 12 }, confine: true };
const fade = (selected: string | null | undefined, name: string, color: string) => (selected && selected !== name ? { color, opacity: FADED } : { color });

export type LineFormat = "pct" | "signedPct" | "num";
const fmtLine = (format: LineFormat) => (v: number) =>
  format === "pct" ? `${v.toFixed(1)}%` : format === "signedPct" ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : v.toFixed(1);

/** Bars on the left axis, a line (usually a rate) on the right. */
export function comboOption(p: {
  rows: Array<{ label: string; bar: number; line: number | null }>;
  barName: string;
  lineName: string;
  lineFormat?: LineFormat;
  selected?: string | null;
  rotate?: number;
  barColor?: string;
  lineMax?: number;
  /** How a category is shown on the axis (the click still hands back the raw label). */
  labelFormat?: (label: string) => string;
}): Option {
  const format = fmtLine(p.lineFormat ?? "pct");
  const color = p.barColor ?? STUDIO_COLORS.blue;
  return {
    animationDuration: 300,
    grid: { left: p.rotate ? 64 : 44, right: 50, top: 18, bottom: p.rotate ? 64 : 38 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: undefined },
    xAxis: { type: "category", data: p.rows.map((r) => r.label), axisLabel: { ...AXIS, rotate: p.rotate ?? 0, interval: p.rows.length > 12 ? "auto" : 0, formatter: p.labelFormat, ...(p.rotate || p.rows.length > 8 ? {} : WRAP) }, axisTick: { show: false }, axisLine: { lineStyle: { color: STUDIO_COLORS.grid } } },
    yAxis: [
      { type: "value", axisLabel: AXIS, splitLine: { lineStyle: { color: STUDIO_COLORS.grid } } },
      { type: "value", axisLabel: { ...AXIS, color: STUDIO_COLORS.orange, formatter: format }, splitLine: { show: false }, ...(p.lineMax ? { max: p.lineMax } : {}), min: p.lineFormat === "signedPct" ? undefined : 0 },
    ],
    series: [
      {
        name: p.barName, type: "bar", barMaxWidth: 52, itemStyle: { borderRadius: [3, 3, 0, 0] },
        data: p.rows.map((r) => ({ value: r.bar, itemStyle: fade(p.selected, r.label, color) })),
      },
      {
        name: p.lineName, type: "line", yAxisIndex: 1, symbol: "circle", symbolSize: 7, connectNulls: true,
        lineStyle: { color: STUDIO_COLORS.orange, width: 2 }, itemStyle: { color: STUDIO_COLORS.orange },
        data: p.rows.map((r) => (r.line === null ? null : Number(r.line.toFixed(2)))),
        tooltip: { valueFormatter: (v: unknown) => (typeof v === "number" ? format(v) : "—") },
      },
    ],
  };
}

/** Plain vertical bars (one series). */
export function barsOption(p: { rows: Array<{ label: string; value: number }>; name: string; selected?: string | null; format?: (v: number) => string; labelFormat?: (label: string) => string }): Option {
  return {
    animationDuration: 300,
    grid: { left: 52, right: 16, top: 18, bottom: 38 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: p.format ? (v: unknown) => p.format!(Number(v)) : undefined },
    xAxis: { type: "category", data: p.rows.map((r) => r.label), axisLabel: { ...AXIS, interval: p.rows.length > 12 ? "auto" : 0, formatter: p.labelFormat, ...(p.rows.length > 8 ? {} : WRAP) }, axisTick: { show: false }, axisLine: { lineStyle: { color: STUDIO_COLORS.grid } } },
    yAxis: { type: "value", axisLabel: AXIS, splitLine: { lineStyle: { color: STUDIO_COLORS.grid } } },
    series: [{ name: p.name, type: "bar", barMaxWidth: 52, itemStyle: { borderRadius: [3, 3, 0, 0] }, data: p.rows.map((r) => ({ value: r.value, itemStyle: fade(p.selected, r.label, STUDIO_COLORS.blue) })) }],
  };
}

/** A donut with its legend beside it: "Completed — 58.7%". */
export function donutOption(p: { items: Array<{ name: string; value: number; color?: string }>; selected?: string | null }): Option {
  const total = p.items.reduce((a, b) => a + b.value, 0) || 1;
  const share = new Map(p.items.map((i) => [i.name, (i.value / total) * 100]));
  return {
    animationDuration: 300,
    tooltip: { ...tooltipBase, trigger: "item", formatter: (x: unknown) => { const i = x as { name: string; value: number }; return `${i.name}<br/>${i.value.toLocaleString("en-NG")} · ${(share.get(i.name) ?? 0).toFixed(1)}%`; } },
    legend: { orient: "vertical", left: "50%", top: "middle", icon: "rect", itemWidth: 11, itemHeight: 11, itemGap: 11, textStyle: { color: STUDIO_COLORS.ink, fontSize: 12, fontFamily: FONT }, formatter: (name: string) => `${name} — ${(share.get(name) ?? 0).toFixed(1)}%`, selectedMode: false },
    series: [{
      type: "pie", radius: ["34%", "58%"], center: ["25%", "50%"], label: { show: false }, startAngle: 90,
      itemStyle: { borderColor: "#fff", borderWidth: 2 },
      data: p.items.map((i, k) => ({ name: i.name, value: i.value, itemStyle: fade(p.selected, i.name, i.color ?? CATEGORY_ORDER[k % CATEGORY_ORDER.length]) })),
    }],
  };
}

/** Horizontal 100% bars, one row per band, the share of each series written inside when it fits. */
export function stacked100Option(p: {
  rows: Array<{ label: string; parts: Record<string, number> }>;
  series: Array<{ name: string; color: string }>;
  selected?: string | null;
}): Option {
  const totals = p.rows.map((r) => Object.values(r.parts).reduce((a, b) => a + b, 0) || 1);
  return {
    animationDuration: 300,
    grid: { left: 8, right: 12, top: 8, bottom: 8, containLabel: true },
    tooltip: { ...tooltipBase, trigger: "item", formatter: (x: unknown) => { const i = x as { seriesName: string; name: string; value: number }; return `${i.name} · ${i.seriesName}<br/>${i.value.toFixed(1)}%`; } },
    xAxis: { type: "value", max: 100, show: false },
    yAxis: { type: "category", inverse: true, data: p.rows.map((r) => r.label), axisLabel: { ...AXIS, color: STUDIO_COLORS.ink, fontSize: 13 }, axisTick: { show: false }, axisLine: { show: false } },
    series: p.series.map((s) => ({
      name: s.name, type: "bar", stack: "all", barWidth: "64%",
      itemStyle: { color: s.color, opacity: p.selected && p.selected !== s.name ? FADED : 1, borderColor: "#fff", borderWidth: 1 },
      label: { show: true, color: "#fff", fontSize: 12, fontFamily: FONT, formatter: (x: { value: number }) => (x.value >= 8 ? `${Math.round(x.value)}%` : "") },
      data: p.rows.map((r, i) => Number((((r.parts[s.name] ?? 0) / totals[i]) * 100).toFixed(2))),
    })),
  };
}

/** Horizontal bars with the value written at the end (funnels, reasons, medians). Negative values go orange. */
export function hbarsOption(p: { rows: Array<{ label: string; value: number; text: string }>; selected?: string | null; color?: string }): Option {
  const color = p.color ?? STUDIO_COLORS.barLight;
  return {
    animationDuration: 300,
    grid: { left: 8, right: 92, top: 6, bottom: 6, containLabel: true },
    tooltip: { ...tooltipBase, trigger: "item", formatter: (x: unknown) => { const i = x as { dataIndex: number }; const r = p.rows[i.dataIndex]; return `${r.label}<br/>${r.text}`; } },
    xAxis: { type: "value", show: false, min: 0 },
    yAxis: { type: "category", inverse: true, data: p.rows.map((r) => r.label), axisLabel: { ...AXIS, color: STUDIO_COLORS.ink, fontSize: 13, width: 230, overflow: "truncate" }, axisTick: { show: false }, axisLine: { show: false } },
    series: [{
      type: "bar", barWidth: "62%",
      label: { show: true, position: "right", color: STUDIO_COLORS.muted, fontSize: 12, fontFamily: FONT, formatter: (x: { dataIndex: number }) => p.rows[x.dataIndex].text },
      // A negative amount is drawn as its size from the same edge, in orange (its text keeps the minus).
      data: p.rows.map((r) => ({ value: Math.abs(r.value) < 1e-9 ? 0 : Math.abs(r.value), itemStyle: fade(p.selected, r.label, r.value < 0 ? "#E98F5E" : color) })),
    }],
  };
}

/** Grouped bars (two or three series per category), with optional dashed reference lines. */
export function groupedOption(p: {
  categories: string[];
  series: Array<{ name: string; color: string; values: Array<number | null> }>;
  yFormat?: (v: number) => string;
  refLines?: Array<{ value: number; label: string }>;
  yMax?: number;
}): Option {
  return {
    animationDuration: 300,
    grid: { left: 52, right: 16, top: 18, bottom: 44 },
    tooltip: { ...tooltipBase, trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: p.yFormat ? (v: unknown) => (typeof v === "number" ? p.yFormat!(v) : "—") : undefined },
    xAxis: { type: "category", data: p.categories, axisLabel: { ...AXIS, fontSize: 11, interval: 0, ...WRAP, width: 58 }, axisTick: { show: false }, axisLine: { lineStyle: { color: STUDIO_COLORS.grid } } },
    yAxis: { type: "value", axisLabel: { ...AXIS, formatter: p.yFormat }, splitLine: { lineStyle: { color: STUDIO_COLORS.grid } }, ...(p.yMax ? { max: p.yMax } : {}) },
    series: p.series.map((s, i) => ({
      name: s.name, type: "bar", barGap: "12%", barMaxWidth: 26, itemStyle: { color: s.color, borderRadius: [3, 3, 0, 0] },
      data: s.values,
      ...(i === 0 && p.refLines ? {
        markLine: {
          symbol: "none", silent: true, lineStyle: { type: "dashed", color: "#B8B8B2" },
          label: { position: "insideEndTop", color: STUDIO_COLORS.muted, fontSize: 11, formatter: (x: { name: string }) => x.name },
          data: p.refLines.map((l) => ({ yAxis: l.value, name: l.label })),
        },
      } : {}),
    })),
  };
}
