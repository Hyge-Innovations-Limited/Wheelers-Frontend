"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AdminApiError } from "@/lib/admin-api";

/* ── page chrome ───────────────────────────────────────────────────────── */

/** A button that shows it is working — the old Refresh gave no feedback at all. */
export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button type="button" className="admin-btn-ghost" onClick={onClick} disabled={busy}>
      <span className={busy ? "admin-refresh-icon spinning" : "admin-refresh-icon"} aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </span>
      {busy ? "Refreshing…" : "Refresh"}
    </button>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-page-head">
      <div>
        <h1 className="admin-page-title">{title}</h1>
        {subtitle ? <p className="admin-page-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="admin-section-head">
      <span className="admin-section-label">{children}</span>
      {right ? <span className="admin-section-right">{right}</span> : null}
    </div>
  );
}

/* ── metrics ───────────────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "green" | "orange" | "red" | "blue";
  href?: string;
}) {
  const body = (
    <>
      <span className="admin-stat-label">{label}</span>
      <span className={`admin-stat-value${tone ? ` ${tone}` : ""}`}>{value}</span>
      {hint ? <span className="admin-stat-hint">{hint}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="admin-stat-card admin-stat-card-link">
        {body}
      </Link>
    );
  }
  return <div className="admin-stat-card">{body}</div>;
}

export function StatGrid({ children, cols }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return <div className={`admin-stats-grid cols-${cols ?? 4}`}>{children}</div>;
}

export function Card({
  title,
  right,
  children,
  padded,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="admin-card">
      {title ? (
        <div className="admin-card-head">
          <span className="admin-card-title">{title}</span>
          {right ? <span className="admin-card-right">{right}</span> : null}
        </div>
      ) : null}
      <div className={padded ? "admin-card-body" : undefined}>{children}</div>
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className ?? "admin-badge gray"}>{children}</span>;
}

/* ── states ────────────────────────────────────────────────────────────── */

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="admin-spinner-wrap">
      <div className="admin-spinner" />
      {label ? <span className="admin-spinner-text">{label}</span> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="admin-empty">{children}</div>;
}

/**
 * An expired session and a broken query are different problems and deserve
 * different messages — the old panel showed "Failed to load" for both.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const isAuth = error instanceof AdminApiError && error.isAuthError;
  const message = error instanceof Error ? error.message : "Something went wrong";

  return (
    <div className="admin-error-state">
      <strong>{isAuth ? "Your session has expired" : "Could not load this view"}</strong>
      <span>{isAuth ? "Sign in again to continue." : message}</span>
      {isAuth ? (
        <Link href="/admin/login" className="admin-btn-primary">
          Go to sign in
        </Link>
      ) : onRetry ? (
        <button type="button" className="admin-btn-primary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/* ── tables ────────────────────────────────────────────────────────────── */

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="admin-table-wrap">{children}</div>;
}

export function Pagination({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">
        {from.toLocaleString("en-NG")}–{to.toLocaleString("en-NG")} of {total.toLocaleString("en-NG")}
      </span>
      <div className="admin-pagination-buttons">
        <button
          type="button"
          className="admin-page-btn"
          disabled={!canPrev}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </button>
        <button
          type="button"
          className="admin-page-btn"
          disabled={!canNext}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ── inputs ────────────────────────────────────────────────────────────── */

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="admin-search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        className="admin-search-input"
        value={value}
        placeholder={placeholder ?? "Search…"}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button type="button" className="admin-search-clear" onClick={() => onChange("")} aria-label="Clear search">
          ×
        </button>
      ) : null}
    </div>
  );
}

export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="admin-tabs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`admin-tab${opt.value === value ? " active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          {typeof opt.count === "number" ? <span className="admin-tab-count">{opt.count.toLocaleString("en-NG")}</span> : null}
        </button>
      ))}
    </div>
  );
}
