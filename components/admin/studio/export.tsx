"use client";

/**
 * "Download Excel": one sheet per Studio tab with exactly the numbers on screen (the same filters), then the data
 * tables. The page renders every tab once, hidden, inside an ExportScope; each chart, KPI row and table hands its
 * numbers to the scope instead of drawing (a chart's numbers are read from its own option, so nothing is computed
 * twice). exceljs loads only when the button is pressed.
 */
import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Filtered } from "@/lib/studio/filters";

export type Cell = string | number | null;
export interface ExportItem { tab: string; title: string; columns: string[]; rows: Cell[][] }

const ScopeCtx = createContext<{ tab: string; add: (item: ExportItem) => void } | null>(null);
const TitleCtx = createContext<string>("");

export const useExportScope = () => useContext(ScopeCtx);
export const usePanelTitle = () => useContext(TitleCtx);

export function ExportScope({ tab, add, children }: { tab: string; add: (item: ExportItem) => void; children: ReactNode }) {
  return <ScopeCtx.Provider value={{ tab, add }}>{children}</ScopeCtx.Provider>;
}
export function PanelTitle({ title, children }: { title: string; children: ReactNode }) {
  return <TitleCtx.Provider value={title}>{children}</TitleCtx.Provider>;
}

/** Hands one table to the export (when there is one); renders nothing. */
export function ExportTable({ title, columns, rows }: { title?: string; columns: string[]; rows: Cell[][] }) {
  const scope = useExportScope();
  const panel = usePanelTitle();
  useEffect(() => {
    scope?.add({ tab: scope.tab, title: title ?? panel, columns, rows });
    // Once per export: the scope is mounted for a single pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** An ECharts option as a table: categories down, one column per series (a donut: name and value). */
export function optionTable(option: Record<string, unknown>): { columns: string[]; rows: Cell[][] } {
  type Series = { name?: string; type?: string; data?: unknown[] };
  const series = (option.series as Series[] | undefined) ?? [];
  const value = (d: unknown): Cell => {
    if (d === null || d === undefined) return null;
    if (typeof d === "number") return Number(d.toFixed(2));
    if (typeof d === "object" && "value" in (d as object)) return value((d as { value: unknown }).value);
    return String(d);
  };
  if (series[0]?.type === "pie") {
    return { columns: ["", "Count"], rows: (series[0].data ?? []).map((d) => [String((d as { name: string }).name), value(d)]) };
  }
  const axis = (a: unknown) => (Array.isArray(a) ? a[0] : a) as { type?: string; data?: unknown[] } | undefined;
  const x = axis(option.xAxis);
  const y = axis(option.yAxis);
  const categories = (x?.type === "category" ? x.data : y?.data) ?? [];
  return {
    columns: ["", ...series.map((s, i) => s.name ?? (series.length === 1 ? "Value" : `Series ${i + 1}`))],
    rows: categories.map((c, i) => [String(c), ...series.map((s) => value(s.data?.[i]))]),
  };
}

const sheetName = (s: string) => s.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

export async function downloadWorkbook(p: { name: string; items: ExportItem[]; tabs: string[]; f: Filtered }): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  book.creator = "Wheelers Analytics Studio";
  for (const tab of p.tabs) {
    const ws = book.addWorksheet(sheetName(tab));
    ws.getColumn(1).width = 34;
    for (let c = 2; c <= 8; c++) ws.getColumn(c).width = 16;
    for (const item of p.items.filter((i) => i.tab === tab)) {
      ws.addRow([item.title]).font = { bold: true, size: 12 };
      ws.addRow(item.columns).font = { bold: true };
      for (const r of item.rows) ws.addRow(r);
      ws.addRow([]);
    }
  }
  const data = (name: string, rows: Array<Record<string, unknown>>) => {
    const ws = book.addWorksheet(sheetName(name));
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    ws.columns = columns.map((key) => ({ header: key, key, width: Math.min(26, Math.max(10, key.length + 2)) }));
    ws.getRow(1).font = { bold: true };
    for (const r of rows) ws.addRow(Object.fromEntries(columns.map((c) => [c, (r[c] ?? null) as Cell])));
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  data("Data · sessions", p.f.sessions.map(({ trip, ...s }) => ({ ...s, ...Object.fromEntries(Object.entries(trip ?? {}).map(([k, v]) => [`trip_${k}`, v])) })));
  data("Data · offers", p.f.offers as unknown as Array<Record<string, unknown>>);
  data("Data · pings", p.f.pings as unknown as Array<Record<string, unknown>>);
  data("Data · price changes", p.f.priceChanges as unknown as Array<Record<string, unknown>>);
  data("Data · payments", p.f.payments as unknown as Array<Record<string, unknown>>);
  data("Data · devices", p.f.devices as unknown as Array<Record<string, unknown>>);
  const blob = new Blob([await book.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = p.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
