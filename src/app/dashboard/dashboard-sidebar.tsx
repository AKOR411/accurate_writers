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
  children?: NavItem[];
  badge?: string;
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
    { href: "/dashboard", label: "Dashboard", icon: "\u2302" },
    {
      href: "/dashboard/available",
      label: "Available",
      icon: "\u25c7",
      children: [
        { href: "/dashboard/new", label: "New", icon: "\u2013" },
        { href: "/dashboard/my-bids", label: "My Bids", icon: "\u2013" },
        { href: "/dashboard/discarded", label: "Discarded", icon: "\u2013" },
        { href: "/dashboard/invited", label: "Invited", icon: "\u2013" },
        { href: "/dashboard/private-available", label: "Private Available", icon: "\u2013" },
      ],
    },
    { href: "/dashboard/in-progress", label: "In Progress", icon: "\u270e" },
    { href: "/dashboard/in-review", label: "In Review", icon: "\u2691" },
    { href: "/dashboard/completed", label: "Completed", icon: "\u25a1" },
    { href: "/dashboard/revision", label: "Revision", icon: "\u270d" },
    { href: "/dashboard/canceled", label: "Canceled", icon: "\u2298" },
    { href: "/dashboard/disputed", label: "Disputed", icon: "\u2615" },
    { href: "/dashboard/profile", label: "Profile", icon: "\u2659" },
    { href: "/dashboard/rating", label: "Rating", icon: "\u2606", badge: "-" },
    { href: "/dashboard/chat", label: "General chat", icon: "\u25ef" },
    { href: "/dashboard/transactions", label: "Transactions", icon: "\u25a3" },
    { href: "/dashboard/fines", label: "Fines", icon: "\u2692" },
    { href: "/dashboard/subscriptions", label: "Subscriptions", icon: "\u0024" },
    { href: "/dashboard/untrusted-employers", label: "Untrusted employers", icon: "\u26a0" },
    { href: "/dashboard/news", label: "News", icon: "\u25a4" },
    { href: "/dashboard/faq", label: "FAQ", icon: "?" },
    { href: "/dashboard/rules", label: "Rules & Regulations", icon: "\u2139" },
  ],
};

export default function DashboardSidebar({
  role,
}: {
  role: AccountRole;
}) {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState("#overview");
  const [availableExpandedOverride, setAvailableExpandedOverride] = useState<boolean | null>(null);
  const availableExpanded = availableExpandedOverride ?? (
    pathname.startsWith("/dashboard/available") ||
      ["/dashboard/new", "/dashboard/my-bids", "/dashboard/discarded", "/dashboard/invited", "/dashboard/private-available"].includes(pathname)
  );

  return (
    <aside className={`dashboard-sidebar role-${role}`}>
      <Link className="dashboard-brand" href="/" aria-label="Accurate Writers home">
        <span className="dashboard-brand-icon" aria-hidden="true">{String.fromCharCode(0x270e)}</span>
        <span>Accurate Writers</span>
      </Link>
      <nav className={`dashboard-nav${role === "writer" ? " writer-navigation" : ""}`} aria-label={`${role} navigation`}>
        {navigation[role].map((item) =>
          item.children ? (
            <div className="dashboard-nav-group" key={item.href}>
              <div className={`dashboard-nav-group-heading${pathname === item.href ? " active" : ""}`}>
                <Link className="dashboard-nav-group-link" href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                  <span className="dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
                <button
                  aria-expanded={availableExpanded}
                  aria-label={`${availableExpanded ? "Collapse" : "Expand"} ${item.label} pages`}
                  className="dashboard-nav-toggle"
                  onClick={() => setAvailableExpandedOverride((expanded) => !(expanded ?? availableExpanded))}
                  type="button"
                >
                  <span aria-hidden="true">{availableExpanded ? "v" : ">"}</span>
                </button>
              </div>
              {availableExpanded && (
                <div className="dashboard-nav-subitems">
                  {item.children.map((child) => (
                    <Link
                      aria-current={pathname === child.href ? "page" : undefined}
                      className={`dashboard-nav-link dashboard-nav-sublink${pathname === child.href ? " active" : ""}`}
                      href={child.href}
                      key={child.href}
                    >
                      <span>{child.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) :
          item.soon ? (
            <span
              aria-disabled="true"
              className="dashboard-nav-link disabled"
              key={item.href}
              title="This feature is not available yet"
            >
              <span className="dashboard-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && <span className="dashboard-nav-badge">{item.badge}</span>}
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
              {item.badge && <span className="dashboard-nav-badge">{item.badge}</span>}
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
