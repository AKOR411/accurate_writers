"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/admin", label: "Overview", icon: "▦" },
  { href: "/admin/users", label: "Users", icon: "♙" },
  { href: "/admin/jobs", label: "Jobs", icon: "▤" },
  { href: "/admin/applications", label: "Applications", icon: "▣" },
  { href: "/admin/payments", label: "Payments", icon: "＄", soon: true },
  { href: "/admin/reports", label: "Reports", icon: "▥" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Admin navigation">
      {navigation.map((item) => {
        const isActive =
          item.href === "/admin"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        if (item.soon) {
          return (
            <span className="admin-nav-link disabled" aria-disabled="true" key={item.href}>
              <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              <span className="admin-nav-soon">Soon</span>
            </span>
          );
        }

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`admin-nav-link${isActive ? " active" : ""}`}
            href={item.href}
            key={item.href}
          >
            <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
      <span className="admin-nav-label">WORKSPACE</span>
      <Link className="admin-nav-link" href="/">
        <span className="admin-nav-icon" aria-hidden="true">↗</span>
        <span>View website</span>
      </Link>
    </nav>
  );
}
