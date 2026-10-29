import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import AdminNavigation from "./admin-navigation";
import { assertAdmin } from "@/lib/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createReadOnlyClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const config = getSupabaseConfig();
  if (!config.configured) {
    redirect("/register?error=configuration");
  }

  const supabase = await createReadOnlyClient();
  const userId = await assertAdmin(supabase);
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Could not load the admin profile: ${error.message}`);
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/">
          <span className="brand-mark" aria-hidden="true">✎</span>
          <span>Accurate Writers</span>
        </Link>
        <div className="admin-workspace">
          <span className="admin-workspace-avatar" aria-hidden="true">A</span>
          <span>
            <strong>Admin workspace</strong>
            <small>Platform management</small>
          </span>
        </div>
        <AdminNavigation />
        <div className="admin-sidebar-footer">
          <span className="admin-online-dot" />
          <span>Secure admin session</span>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <strong>Administration</strong>
          </div>
          <div className="admin-account">
            <span className="admin-account-avatar" aria-hidden="true">
              {profile.full_name.slice(0, 1).toUpperCase()}
            </span>
            <span className="admin-account-name">
              <strong>{profile.full_name}</strong>
              <small>Administrator</small>
            </span>
            <form action={logout}>
              <button className="admin-signout" type="submit">Sign out</button>
            </form>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
