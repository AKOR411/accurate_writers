"use client";

import { useState } from "react";
import Link from "next/link";
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
    { href: "#overview", label: "Dashboard", icon: "▦" },
    { href: "#post-job", label: "Post a Job", icon: "＋" },
    { href: "#my-jobs", label: "My Jobs", icon: "▤" },
    { href: "#applications", label: "Applications", icon: "▣" },
    { href: "#writers", label: "Writers", icon: "♙" },
    { href: "#messages", label: "Messages", icon: "▱", soon: true },
    { href: "#payments", label: "Payments", icon: "＄", soon: true },
    { href: "#profile", label: "Profile", icon: "◉", soon: true },
    { href: "#settings", label: "Settings", icon: "⚙", soon: true },
  ],
  writer: [
    { href: "#overview", label: "Dashboard", icon: "▦" },
    { href: "#find-jobs", label: "Find Jobs", icon: "⌕" },
    { href: "#my-applications", label: "My Applications", icon: "▣" },
    { href: "#my-articles", label: "My Articles", icon: "▤", soon: true },
    { href: "#payments", label: "Payments", icon: "＄", soon: true },
    { href: "#profile", label: "Profile", icon: "◉", soon: true },
    { href: "#settings", label: "Settings", icon: "⚙", soon: true },
  ],
};

export default function DashboardSidebar({
  role,
}: {
  role: AccountRole;
}) {
  const [activeHref, setActiveHref] = useState("#overview");

  return (
    <aside className={`dashboard-sidebar role-${role}`}>
      <Link className="dashboard-brand" href="/" aria-label="Accurate Writers home">
        <span className="dashboard-brand-icon" aria-hidden="true">✎</span>
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
            <a
              aria-current={activeHref === item.href ? "page" : undefined}
              className={`dashboard-nav-link${activeHref === item.href ? " active" : ""}`}
              href={item.href}
              key={item.href}
              onClick={() => setActiveHref(item.href)}
            >
              <span className="dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ),
        )}
      </nav>
      <form action={logout} className="dashboard-sidebar-logout">
        <button className="dashboard-nav-link" type="submit">
          <span className="dashboard-nav-icon" aria-hidden="true">⇥</span>
          <span>Log out</span>
        </button>
      </form>
    </aside>
  );
}
