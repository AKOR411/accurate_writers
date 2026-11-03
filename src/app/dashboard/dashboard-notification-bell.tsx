"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { markDashboardNotificationsRead } from "@/app/actions/dashboard";
import type { Database } from "@/lib/supabase/database.types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export default function DashboardNotificationBell({
  notifications,
}: {
  notifications: NotificationRow[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 30000);
    return () => window.clearInterval(interval);
  }, [router]);

  function openNotification(notification: NotificationRow) {
    if (!notification.read_at) {
      startTransition(async () => {
        await markDashboardNotificationsRead([notification.id]);
        router.push(notification.href);
        router.refresh();
      });
      return;
    }
    router.push(notification.href);
  }

  function markAllRead() {
    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (!unreadIds.length) return;
    startTransition(async () => {
      await markDashboardNotificationsRead(unreadIds);
      router.refresh();
    });
  }

  return (
    <div className="dashboard-notification-wrap">
      <button
        aria-expanded={open}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="dashboard-notification-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span aria-hidden="true">{String.fromCodePoint(0x1f514)}</span>
        {unreadCount > 0 && <span className="dashboard-notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <section aria-label="Notifications" className="dashboard-notification-popover">
          <header>
            <div><strong>Notifications</strong><span>{unreadCount} unread</span></div>
            <button disabled={isPending || unreadCount === 0} onClick={markAllRead} type="button">Mark all read</button>
          </header>
          <div className="dashboard-notification-list">
            {notifications.length ? notifications.map((notification) => (
              <button
                className={`dashboard-notification-item${notification.read_at ? " read" : " unread"}`}
                key={notification.id}
                onClick={() => openNotification(notification)}
                type="button"
              >
                <span className="dashboard-notification-dot" aria-hidden="true" />
                <span className="dashboard-notification-copy">
                  <strong>{notification.title}</strong>
                  <span>{notification.body}</span>
                  <small>{new Date(notification.created_at).toLocaleString()}</small>
                </span>
              </button>
            )) : <p className="dashboard-notification-empty">You are all caught up.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
