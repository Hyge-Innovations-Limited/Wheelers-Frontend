"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import "../../../styles/admin.css";

interface AdminUser {
  id: string;
  username: string;
  name: string;
}

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
    case "rides":
      return (
        <svg {...props}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
    case "activity":
      return (
        <svg {...props}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/dashboard/drivers", label: "Drivers", icon: "drivers" },
  { href: "/admin/dashboard/riders", label: "Riders", icon: "riders" },
  { href: "/admin/dashboard/rides", label: "Rides", icon: "rides" },
  { href: "/admin/dashboard/activity", label: "Activity", icon: "activity" },
];

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

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

  function handleLogout() {
    localStorage.removeItem("wheelers_admin_token");
    localStorage.removeItem("wheelers_admin_user");
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
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <h1>Wheelers</h1>
        </div>

        <nav className="admin-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-link ${isActive(item.href) ? "active" : ""}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
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
              <span className="admin-user-role">Admin</span>
            </div>
          </div>
          <button onClick={handleLogout} className="admin-logout-btn">
            <Icon name="logout" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
