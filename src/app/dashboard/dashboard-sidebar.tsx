"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import type { AccountRole } from "@/lib/supabase/database.types";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  soon?: boolean;
};

const navigation: Record<AccountRole, NavItem[]> = {
  employer: [
    { href: "/dashboard", label: "Dashboard", icon: "\u25A6" },
    { href: "#post-job", label: "Post a Job", icon: "\uFF0B" },
    { href: "#my-jobs", label: "My Jobs", icon: "\u25A4" },
    { href: "#applications", label: "Applications", icon: "\u25A3" },
    { href: "#writers", label: "Writers", icon: "\u2659" },
    { href: "#messages", label: "Messages", icon: "\u25B1", soon: true },
    { href: "#payments", label: "Payments", icon: "\uFF04", soon: true },
    { href: "#profile", label: "Profile", icon: "\u25C9", soon: true },
    { href: "#settings", label: "Settings", icon: "\u2699", soon: true },
  ],
  writer: [
    { href: "/dashboard", label: "Dashboard", icon: "\u25A6" },
    { href: "/dashboard/jobs", label: "Find Jobs", icon: "\u2315" },
    { href: "/dashboard/applications", label: "My Applications", icon: "\u25A3" },
    { href: "/dashboard/articles", label: "My Articles", icon: "\u25A4" },
    { href: "/dashboard/payments", label: "Payments", icon: "\uFF04" },
    { href: "/dashboard/profile", label: "Profile", icon: "\u25C9" },
    { href: "/dashboard/settings", label: "Settings", icon: "\u2699" },
  ],
};

export default function DashboardSidebar({
  role,
}: {
  role: AccountRole;
}) {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState("#overview");

  return (
    <aside className={`dashboard-sidebar role-${role}`}>
      <Link className="dashboard-brand" href="/" aria-label="Accurate Writers home">
        <span className="dashboard-brand-icon" aria-hidden="true">{String.fromCharCode(0x270e)}</span>
        <span>Accurate Writers</span>
      </Link>
      <nav className="dashboard-nav" aria-label={`${role} navigation`}>
        {navigation[role].map((item) =>
          item.soon ? (
            <span
              aria-disabled="true"
              className="dashboard-nav-link disabled"
              key={item.href}
              title="This feature is not available yet"
            >
              <span className="dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              <span className="dashboard-nav-soon">Soon</span>
            </span>
          ) : (
            <Link
              aria-current={(item.href.startsWith("#") ? activeHash === item.href : pathname === item.href) ? "page" : undefined}
              className={`dashboard-nav-link${(item.href.startsWith("#") ? activeHash === item.href : pathname === item.href) ? " active" : ""}`}
              href={item.href}
              key={item.href}
              onClick={() => item.href.startsWith("#") && setActiveHash(item.href)}
            >
              <span className="dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ),
        )}
      </nav>
      <form action={logout} className="dashboard-sidebar-logout">
        <button className="dashboard-nav-link" type="submit">
          <span className="dashboard-nav-icon" aria-hidden="true">{String.fromCharCode(0x21e5)}</span>
          <span>Log out</span>
        </button>
      </form>
    </aside>
  );
}
