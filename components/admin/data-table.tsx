"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { EmptyState, ErrorState, Pagination, Spinner, TableWrap } from "@/components/admin/ui";

export interface Column<T> {
  key: string;
  label: string;
  /** Right-aligned, tabular figures. */
  numeric?: boolean;
  /** The server's sort key for this column; omit for a column that cannot sort. */
  sortKey?: string;
  render: (row: T) => ReactNode;
  /** A short explanation shown on hover over the header. */
  title?: string;
}

/**
 * The spreadsheet-style table behind every number on Home and Fees. Sorting,
 * searching and paging all happen on the server, so a sorted column is sorted
 * across every row, not just the page on screen. Click a header to sort by it;
 * click again to flip the direction.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  loading,
  error,
  onRetry,
  empty,
  sort,
  dir,
  onSort,
  paging,
}: {
  columns: Array<Column<T>>;
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  empty: string;
  sort?: string | null;
  dir?: "asc" | "desc" | null;
  onSort?: (sort: string, dir: "asc" | "desc") => void;
  paging?: { offset: number; limit: number; total: number; onChange: (offset: number) => void };
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading && !rows) return <Spinner />;
  if (!rows || rows.length === 0) return <EmptyState>{empty}</EmptyState>;

  const header = (c: Column<T>) => {
    if (!c.sortKey || !onSort) return c.label;
    const active = sort === c.sortKey;
    const nextDir: "asc" | "desc" = active && dir !== "asc" ? "asc" : "desc";
    return (
      <button
        type="button"
        className={`admin-sort${active ? " active" : ""}`}
        onClick={() => onSort(c.sortKey!, nextDir)}
        aria-label={`Sort by ${c.label}`}
      >
        {c.label}
        <span className="admin-sort-arrow" aria-hidden>{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    );
  };

  return (
    <>
      <TableWrap>
        <table className={`admin-table admin-data-table${loading ? " is-refreshing" : ""}`}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.numeric ? "num" : undefined} title={c.title}>
                  {header(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = rowHref?.(row) ?? null;
              return (
                <tr key={rowKey(row)} className={href ? "admin-row-link" : undefined}>
                  {columns.map((c, i) => (
                    <td key={c.key} className={c.numeric ? "num" : undefined}>
                      {href && i === 0 ? <Link href={href}>{c.render(row)}</Link> : c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      {paging ? <Pagination {...paging} /> : null}
    </>
  );
}
