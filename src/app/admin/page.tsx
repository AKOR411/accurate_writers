import Link from "next/link";
import { requireAdminClient } from "@/lib/admin";

function assertQuery<T>(
  label: string,
  result: { data: T | null; error: { message: string } | null },
): T {
  if (result.error) {
    throw new Error(`Could not load ${label}: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`Could not load ${label}: Supabase returned no data.`);
  }
  return result.data;
}

function assertCount(
  label: string,
  result: { count: number | null; error: { message: string } | null },
) {
  if (result.error) {
    throw new Error(`Could not load ${label}: ${result.error.message}`);
  }
  return result.count ?? 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeZone: "Africa/Nairobi",
  }).format(new Date(value));
}

export default async function AdminOverviewPage() {
  const supabase = await requireAdminClient();
  const [
    totalUsersResult,
    writerCountResult,
    employerCountResult,
    openJobsResult,
    pendingJobsResult,
    totalApplicationsResult,
    pendingApplicationsResult,
    recentUsersResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "writer"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "employer"),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("applications").select("id", { count: "exact", head: true }),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const totalUsers = assertCount("user count", totalUsersResult);
  const writers = assertCount("writer count", writerCountResult);
  const employers = assertCount("employer count", employerCountResult);
  const openJobs = assertCount("approved job count", openJobsResult);
  const pendingJobs = assertCount("pending job count", pendingJobsResult);
  const totalApplications = assertCount("application count", totalApplicationsResult);
  const pendingApplications = assertCount(
    "pending application count",
    pendingApplicationsResult,
  );
  const recentUsers = assertQuery("recent users", recentUsersResult);

  const metrics = [
    { label: "Total users", value: totalUsers, icon: "♙", accent: "blue" },
    { label: "Writers", value: writers, icon: "✎", accent: "violet" },
    { label: "Employers", value: employers, icon: "▣", accent: "amber" },
    { label: "Live jobs", value: openJobs, icon: "▤", accent: "green" },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">PLATFORM OVERVIEW</p>
          <h1>Your Accurate Writers workspace.</h1>
          <p className="admin-page-subtitle">
            A live overview of your Accurate Writers marketplace.
          </p>
        </div>
      </div>

      <div className="admin-metrics">
        {metrics.map((metric) => (
          <article className="admin-metric-card" key={metric.label}>
            <div className={`admin-metric-icon ${metric.accent}`} aria-hidden="true">
              {metric.icon}
            </div>
            <span className="admin-metric-label">{metric.label}</span>
            <strong className="admin-metric-value">
              {metric.value.toLocaleString("en-KE")}
            </strong>
            <span className="admin-metric-caption">Current total</span>
          </article>
        ))}
      </div>

      <div className="admin-summary-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">RECENT SIGNUPS</p>
              <h2>New community members</h2>
            </div>
            <Link href="/admin/users">View all <span aria-hidden="true">↗</span></Link>
          </div>
          {recentUsers.length > 0 ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Account type</th>
                    <th scope="col">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="admin-person">
                          <span className="admin-person-avatar" aria-hidden="true">
                            {user.full_name.slice(0, 1).toUpperCase()}
                          </span>
                          <span>
                            <strong>{user.full_name}</strong>
                            <small>{user.email}</small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-role-badge ${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>{formatDate(user.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty">
              <span aria-hidden="true">♙</span>
              <strong>Your community is just getting started.</strong>
              <p>New registrations will appear here.</p>
            </div>
          )}
        </section>

        <section className="admin-panel admin-queue-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">NEEDS ATTENTION</p>
              <h2>Review queue</h2>
            </div>
            <span className="admin-live-dot" aria-label="Live counts" />
          </div>
          <Link className="admin-queue-item" href="/admin/jobs">
            <span className="admin-queue-icon amber" aria-hidden="true">▤</span>
            <span>
              <strong>Jobs awaiting review</strong>
              <small>Check new opportunities before publishing</small>
            </span>
            <b>{pendingJobs}</b>
          </Link>
          <Link className="admin-queue-item" href="/admin/applications">
            <span className="admin-queue-icon blue" aria-hidden="true">▣</span>
            <span>
              <strong>Pending applications</strong>
              <small>Keep applications moving for both sides</small>
            </span>
            <b>{pendingApplications}</b>
          </Link>
          <div className="admin-total-row">
            <span>Total applications</span>
            <strong>{totalApplications.toLocaleString("en-KE")}</strong>
          </div>
        </section>
      </div>

      <section className="admin-note-panel">
        <span className="admin-note-icon" aria-hidden="true">✦</span>
        <div>
          <strong>A healthier marketplace starts with clear expectations.</strong>
          <p>
            Review job details and keep application decisions timely. Financial
            reporting will be added when payment processing is connected.
          </p>
        </div>
        <Link href="/admin/reports">View reports <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
