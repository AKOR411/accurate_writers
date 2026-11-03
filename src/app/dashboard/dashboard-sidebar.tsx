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
    { href: "/dashboard", label: "Dashboard", icon: "\u2302" },
    {
      href: "/dashboard/employer/orders", label: "Orders", icon: "\u25c7",
      children: [
        { href: "/dashboard/employer/post-order", label: "Post an Order", icon: "\u2013" },
        { href: "/dashboard/employer/all-orders", label: "All", icon: "\u2013" },
        { href: "/dashboard/employer/draft-orders", label: "Draft Orders", icon: "\u2013" },
        { href: "/dashboard/employer/request-bid", label: "Request / Bid", icon: "\u2013" },
        { href: "/dashboard/employer/tasks", label: "Tasks", icon: "\u2013" },
        { href: "/dashboard/employer/public", label: "Public", icon: "\u2013" },
        { href: "/dashboard/employer/escrowed", label: "Escrowed", icon: "\u2013" },
        { href: "/dashboard/employer/in-progress", label: "In Progress", icon: "\u2013" },
        { href: "/dashboard/employer/unconfirmed", label: "Unconfirmed", icon: "\u2013" },
        { href: "/dashboard/employer/submitted", label: "Submitted", icon: "\u2013" },
        { href: "/dashboard/employer/in-revision", label: "In Revision", icon: "\u2013" },
        { href: "/dashboard/employer/completed", label: "Completed", icon: "\u2013" },
        { href: "/dashboard/employer/disputed", label: "Disputed", icon: "\u2013" },
        { href: "/dashboard/employer/unpaid", label: "Unpaid / Incomplete", icon: "\u2013" },
        { href: "/dashboard/employer/paid", label: "Paid", icon: "\u2013" },
        { href: "/dashboard/employer/canceled", label: "Canceled", icon: "\u2013" },
        { href: "/dashboard/employer/test", label: "Test", icon: "\u2013" },
        { href: "/dashboard/employer/request", label: "Request", icon: "\u2013" },
        { href: "/dashboard/employer/overdue-public", label: "Overdue Public", icon: "\u2013" },
        { href: "/dashboard/employer/overdue-private", label: "Overdue Private", icon: "\u2013" },
        { href: "/dashboard/employer/partially-paid", label: "Partially Paid", icon: "\u2013" },
        { href: "/dashboard/employer/old-orders", label: "Old Orders", icon: "\u2013" },
      ],
    },
    {
      href: "/dashboard/employer/my-writers", label: "My Writers", icon: "\u2659",
      children: [
        { href: "/dashboard/employer/private-writers", label: "Private", icon: "\u2013", badge: "0" },
        { href: "/dashboard/employer/public-writers", label: "Public", icon: "\u2013", badge: "0" },
        { href: "/dashboard/employer/favourite-public", label: "Favourite (Public)", icon: "\u2013", badge: "0" },
        { href: "/dashboard/employer/suspended-writers", label: "Suspended", icon: "\u2013", badge: "0" },
        { href: "/dashboard/employer/unapproved-writers", label: "Unapproved", icon: "\u2013", badge: "0" },
        { href: "/dashboard/employer/invite-writer", label: "Invite Writer", icon: "\u2013" },
      ],
    },
    { href: "/dashboard/employer/manage-reviews", label: "Manage Reviews", icon: "\u2606" },
    { href: "/dashboard/employer/chat", label: "Chat", icon: "\u25ef" },
    {
      href: "/dashboard/employer/all-accounts", label: "My Accounts", icon: "\u25a3",
      children: [
        { href: "/dashboard/employer/all-accounts", label: "All Accounts", icon: "\u2013" },
        { href: "/dashboard/employer/add-account", label: "Add Account", icon: "\u2013" },
      ],
    },
    {
      href: "/dashboard/employer/transaction-history", label: "Transaction History", icon: "\u0024",
      children: [
        { href: "/dashboard/employer/wallet-statement", label: "Wallet Statement", icon: "\u2013" },
        { href: "/dashboard/employer/sms", label: "SMS", icon: "\u2013" },
        { href: "/dashboard/employer/plag-checker", label: "Plag Checker", icon: "\u2013" },
      ],
    },
    {
      href: "/dashboard/employer/subscriptions", label: "Subscriptions", icon: "\u0024",
      children: [
        { href: "/dashboard/employer/subscribe", label: "Subscribe", icon: "\u2013" },
        { href: "/dashboard/employer/active-subscriptions", label: "Active", icon: "\u2013" },
        { href: "/dashboard/employer/expired-subscriptions", label: "Expired", icon: "\u2013" },
      ],
    },
    { href: "/dashboard/employer/guidelines", label: "Guidelines / FAQs", icon: "?" },
    { href: "/dashboard/employer/untrusted-writers", label: "Untrusted Writers", icon: "\u26a0" },
    { href: "/dashboard/employer/news", label: "News", icon: "\u25a4" },
    { href: "/dashboard/employer/rules", label: "Rules & Regulations", icon: "\u2139" },
  ],
  writer: [
    { href: "/dashboard", label: "Dashboard", icon: "\u2302" },
    { href: "/dashboard/offers", label: "Job Offers", icon: "\u2709" },
    { href: "/dashboard/assignments", label: "My Assignments", icon: "\u25a1" },
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
    {
      href: "/dashboard/completed",
      label: "Completed",
      icon: "\u25a1",
      children: [
        { href: "/dashboard/pending-payment", label: "Pending payment", icon: "\u2013" },
        { href: "/dashboard/paid", label: "Paid", icon: "\u2013" },
      ],
    },
    { href: "/dashboard/revision", label: "Revision", icon: "\u270d" },
    { href: "/dashboard/canceled", label: "Canceled", icon: "\u2298" },
    { href: "/dashboard/disputed", label: "Disputed", icon: "\u2615" },
    { href: "/dashboard/profile", label: "Profile", icon: "\u2659" },
    { href: "/dashboard/rating", label: "Rating", icon: "\u2606", badge: "-" },
    { href: "/dashboard/chat", label: "General chat", icon: "\u25ef" },
    { href: "/dashboard/transactions", label: "Transactions", icon: "\u25a3" },
    { href: "/dashboard/fines", label: "Fines", icon: "\u2692" },
    {
      href: "/dashboard/subscriptions",
      label: "Subscriptions",
      icon: "\u0024",
      children: [
        { href: "/dashboard/subscribe", label: "Subscribe", icon: "\u2013" },
        { href: "/dashboard/active-subscriptions", label: "Active Subscriptions", icon: "\u2013" },
      ],
    },
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const isGroupExpanded = (item: NavItem) => expandedGroups[item.href] ?? (
    pathname === item.href || item.children?.some((child) => child.href === pathname) === true
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
                  aria-expanded={isGroupExpanded(item)}
                  aria-label={`${isGroupExpanded(item) ? "Collapse" : "Expand"} ${item.label} pages`}
                  className="dashboard-nav-toggle"
                  onClick={() => setExpandedGroups((groups) => ({
                    ...groups,
                    [item.href]: !isGroupExpanded(item),
                  }))}
                  type="button"
                >
                  <span aria-hidden="true">{isGroupExpanded(item) ? "v" : ">"}</span>
                </button>
              </div>
              {isGroupExpanded(item) && (
                <div className="dashboard-nav-subitems">
                  {item.children.map((child) => (
                    <Link
                      aria-current={pathname === child.href ? "page" : undefined}
                      className={`dashboard-nav-link dashboard-nav-sublink${pathname === child.href ? " active" : ""}`}
                      href={child.href}
                      key={child.href}
                    >
                      <span>{child.label}</span>
                      {child.badge && <span className="dashboard-nav-badge">{child.badge}</span>}
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
