import { redirect } from "next/navigation";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { AccountRole } from "@/lib/supabase/database.types";
import { createReadOnlyClient } from "@/lib/supabase/server";

export const instant = false;

const roleLabels: Record<AccountRole, string> = {
  employer: "Employer",
  writer: "Writer",
};

export default async function DashboardPage() {
  const config = getSupabaseConfig();
  if (!config.configured) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-card">
          <p className="section-kicker">BACKEND SETUP</p>
          <h1>Connect your Supabase project</h1>
          <p>{config.message}</p>
          <p>
            Add the database migration in <code>supabase/migrations</code> to
            your Supabase project before using the dashboard.
          </p>
          <Link className="button" href="/">
            Back to Accurate Writers
          </Link>
        </section>
      </main>
    );
  }

  const supabase = await createReadOnlyClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) {
    throw new Error(`Could not verify the Supabase session: ${claimsError.message}`);
  }

  const userId = claims?.claims?.sub;
  if (!userId) {
    redirect("/register?mode=login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .single();

  if (profileError) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-card">
          <p className="section-kicker">PROFILE SETUP</p>
          <h1>Your account needs one more step</h1>
          <p>
            We could not load your profile. Confirm that the Accurate Writers
            profile migration has been applied in Supabase, then try again.
          </p>
          <p className="auth-notice" role="status">{profileError.message}</p>
          <form action={logout}>
            <button className="button" type="submit">Sign out</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">✎</span>
          <span>Accurate Writers</span>
        </Link>
        <form action={logout}>
          <button className="dashboard-signout" type="submit">Sign out</button>
        </form>
      </header>
      <section className="dashboard-content">
        <p className="section-kicker">{roleLabels[profile.role]} DASHBOARD</p>
        <h1>Welcome, {profile.full_name}.</h1>
        <p>
          Your account is ready. We&apos;re building the tools to help you find
          the right writing opportunities and connections.
        </p>
        <div className="dashboard-next-steps">
          <article>
            <span className="dashboard-next-icon" aria-hidden="true">01</span>
            <h2>Complete your profile</h2>
            <p>Add the details that help the right people find you.</p>
          </article>
          <article>
            <span className="dashboard-next-icon" aria-hidden="true">02</span>
            <h2>{profile.role === "writer" ? "Explore writing jobs" : "Post a writing job"}</h2>
            <p>
              {profile.role === "writer"
                ? "Discover projects that fit your skills and experience."
                : "Share a clear brief and connect with talented writers."}
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
