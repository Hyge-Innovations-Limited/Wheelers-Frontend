"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { adminJson, clearSession, endSession, fetchAlertCounts, sessionExpiresAt } from "@/lib/admin-api";
import { AdminSessionProvider, type AdminSessionUser } from "@/lib/admin-session";
import { ScreenGuard } from "@/components/admin/screen-guard";
import "../../../styles/admin.css";

type AdminUser = Partial<AdminSessionUser> & { username: string; name: string };

function Icon({ name }: { name: string }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case "drivers":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
        </svg>
      );
    case "riders":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </svg>
      );
    case "group":
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3.2" />
          <circle cx="16.5" cy="9.5" r="2.6" />
          <path d="M3.5 20v-1.6A3.9 3.9 0 0 1 7.4 14.5h3.2a3.9 3.9 0 0 1 3.9 3.9V20" />
          <path d="M20.5 20v-1.4a3.2 3.2 0 0 0-2.6-3.1" />
        </svg>
      );
    case "team":
      return (
        <svg {...props}>
          <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" />
          <path d="M9.5 12.5l1.8 1.8 3.6-3.8" />
        </svg>
      );
    case "health":
      return (
        <svg {...props}>
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
          <path d="M3.5 12h4l2-3 3 6 2-3h6" />
        </svg>
      );
    case "stellar":
      return (
        <svg {...props}>
          <path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z" />
        </svg>
      );
    case "rides":
      return (
        <svg {...props}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    case "fees":
      return (
        <svg {...props}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      );
    case "activity":
      return (
        <svg {...props}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "alerts":
      return (
        <svg {...props}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "map":
      return (
        <svg {...props}>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    default:
      return null;
  }
}

// "Riders" and "Activity" are gone: riders were only ever a top-10 leaderboard,
// and Activity was a dead page until you pasted a raw user id into it. Both now
// live where they belong — inside the user directory and each user's profile.
const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/admin/dashboard/live-map", label: "Live map", icon: "map" },
  { href: "/admin/dashboard/users", label: "Users", icon: "riders" },
  { href: "/admin/dashboard/rides", label: "Rides", icon: "rides" },
  { href: "/admin/dashboard/fees", label: "Fees", icon: "fees" },
  { href: "/admin/dashboard/stellar", label: "Stellar", icon: "stellar" },
  { href: "/admin/dashboard/group-rides", label: "Group rides", icon: "group" },
  { href: "/admin/dashboard/drivers", label: "Driver KYC", icon: "drivers" },
  { href: "/admin/dashboard/alerts", label: "Alerts", icon: "alerts", badge: "alerts" },
  { href: "/admin/dashboard/usage", label: "Usage", icon: "activity" },
  { href: "/admin/dashboard/health", label: "Health", icon: "health" },
  { href: "/admin/dashboard/team", label: "Team", icon: "team", badge: "flags", ownerOnly: true },
];

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // On a phone the sidebar is a drawer behind the menu button in the top bar.
  const [navOpen, setNavOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);
  /**
   * Emergency alerts waiting on a human.
   *
   * Polled from the layout rather than the alerts page, because the whole point
   * is that an operator sitting on the Overview screen finds out someone
   * pressed the button — without having to think to go and look.
   */
  const [liveAlerts, setLiveAlerts] = useState(0);
  // Owners: flagged team events (screenshots, blocked downloads) in the last day.
  const [teamFlags, setTeamFlags] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("wheelers_admin_token");
    const userStr = localStorage.getItem("wheelers_admin_user");

    if (!token || !userStr) {
      router.replace("/admin/login");
      return;
    }

    try {
      setAdmin(JSON.parse(userStr));
    } catch {
      router.replace("/admin/login");
      return;
    }

    setReady(true);
  }, [router]);

  // Two hours from login, out: on the dot while the tab is open, and the
  // moment a tab that slept through it comes back.
  useEffect(() => {
    if (!ready) return;
    const expiresAt = sessionExpiresAt();
    if (expiresAt === null) return;
    const check = () => {
      if (Date.now() >= expiresAt) endSession();
    };
    check();
    const timer = setTimeout(check, Math.max(0, expiresAt - Date.now()) + 500);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const counts = await fetchAlertCounts();
        if (!cancelled) setLiveAlerts(counts.live);
      } catch {
        // A failed poll leaves the last known count alone. Zeroing the badge on
        // a network blip would be worse than showing a slightly stale number.
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ready]);

  // Who is signed in, from the server: the role decides what is shown.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    adminJson<AdminSessionUser>("/admin/me")
      .then((me) => {
        if (cancelled) return;
        setAdmin(me);
        localStorage.setItem("wheelers_admin_user", JSON.stringify(me));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [ready]);

  const isOwner = admin?.role === "OWNER";

  useEffect(() => {
    if (!ready || !isOwner) return;
    let cancelled = false;
    const poll = () => adminJson<{ last24h: number }>("/admin/team/flags")
      .then((r) => { if (!cancelled) setTeamFlags(r.last24h); })
      .catch(() => undefined);
    void poll();
    const timer = setInterval(() => void poll(), 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [ready, isOwner]);

  function handleLogout() {
    clearSession();
    router.replace("/admin/login");
  }

  if (!ready) {
    return (
      <div className="admin-login-page">
        <div className="admin-spinner-wrap">
          <div className="admin-spinner"></div>
        </div>
      </div>
    );
  }

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href));

  return (
    <div className={`admin-layout${navOpen ? " nav-open" : ""}`}>
      {/* Phones only (see admin.css): the brand, the alert count and a menu button. */}
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-menu-btn"
          aria-label={navOpen ? "Close menu" : "Open menu"}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {navOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <span className="admin-topbar-brand">Wheelers</span>
        {liveAlerts > 0 ? (
          <Link href="/admin/dashboard/alerts" className="admin-topbar-alerts" onClick={() => setNavOpen(false)}>
            {liveAlerts > 99 ? "99+" : liveAlerts} alerts
          </Link>
        ) : null}
      </header>
      <div className="admin-nav-overlay" onClick={() => setNavOpen(false)} aria-hidden />

      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <h1>Wheelers</h1>
        </div>

        <nav className="admin-sidebar-nav">
          {NAV_ITEMS.filter((item) => !("ownerOnly" in item && item.ownerOnly) || isOwner).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-link ${isActive(item.href) ? "active" : ""}`}
              onClick={() => setNavOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.badge === "alerts" && liveAlerts > 0 ? (
                <span className="admin-nav-badge">
                  {liveAlerts > 99 ? "99+" : liveAlerts}
                </span>
              ) : null}
              {item.badge === "flags" && teamFlags > 0 ? (
                <span className="admin-nav-badge">
                  {teamFlags > 99 ? "99+" : teamFlags}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">
            <div className="admin-avatar">
              {admin?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="admin-user-info">
              <span className="admin-user-name">{admin?.name}</span>
              <span className="admin-user-role">{admin?.role === "OWNER" ? "Owner" : admin?.role === "STAFF" ? "Staff" : "Admin"}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="admin-logout-btn">
            <Icon name="logout" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <AdminSessionProvider
        value={{
          admin: admin ? { id: admin.id ?? null, username: admin.username, name: admin.name, role: admin.role ?? "STAFF", markCode: admin.markCode ?? null } : null,
          isOwner,
        }}
      >
        <main className="admin-main">{children}</main>
      </AdminSessionProvider>
      <ScreenGuard markCode={admin?.markCode ?? null} />
    </div>
  );
}
