import Link from "next/link";
import { notFound } from "next/navigation";
import StatusForm from "@/app/admin/status-form";
import DisputeStatusForm from "@/app/admin/dispute-status-form";
import { requireAdminClient } from "@/lib/admin";

export const instant = false;

type Section =
  | "users"
  | "jobs"
  | "applications"
  | "disputes"
  | "payments"
  | "reports"
  | "settings";

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

function formatBudget(min: number, max: number, currency: string) {
  const formatter = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  if (min === max) {
    return formatter.format(min);
  }

  return `${formatter.format(min)}–${formatter.format(max)}`;
}

function pageHeading(section: Section) {
  const headings: Record<Section, { eyebrow: string; title: string; subtitle: string }> = {
    users: {
      eyebrow: "COMMUNITY",
      title: "Users",
      subtitle: "Writer and employer accounts across the marketplace.",
    },
    jobs: {
      eyebrow: "OPPORTUNITY MANAGEMENT",
      title: "Jobs",
      subtitle: "Review and manage writing opportunities on the platform.",
    },
    applications: {
      eyebrow: "CANDIDATE PIPELINE",
      title: "Applications",
      subtitle: "Track applications and keep decisions moving.",
    },
    disputes: {
      eyebrow: "CASE MANAGEMENT",
      title: "Disputes",
      subtitle: "Review assignment disputes and record resolution decisions.",
    },
    payments: {
      eyebrow: "FINANCIAL OPERATIONS",
      title: "Payments",
      subtitle: "Track employer collections and confirmed M-PESA transactions.",
    },
    reports: {
      eyebrow: "PLATFORM HEALTH",
      title: "Reports",
      subtitle: "Current marketplace totals from Supabase.",
    },
    settings: {
      eyebrow: "ACCESS CONTROL",
      title: "Admin settings",
      subtitle: "Manage administrator access securely through Supabase.",
    },
  };

  return headings[section];
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`admin-status-badge ${status}`}>
      <span aria-hidden="true" />
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default async function AdminSectionPage({
  params,
}: PageProps<"/admin/[section]">) {
  const { section: rawSection } = await params;
  const validSections: Section[] = [
    "users",
    "jobs",
    "applications",
    "disputes",
    "payments",
    "reports",
    "settings",
  ];
  if (!validSections.some((section) => section === rawSection)) {
    notFound();
  }

  const section = rawSection as Section;
  const heading = pageHeading(section);
  const supabase = await requireAdminClient();

  if (section === "payments") {
    const payments = assertQuery("assignment payments", await supabase.from("payments").select("id, assignment_id, amount, currency, status, collection_status, provider_reference, collection_confirmed_at, created_at").order("created_at", { ascending: false }).limit(100));
    const paymentIds = payments.map((payment) => payment.id);
    const attempts = paymentIds.length ? assertQuery("Daraja attempts", await supabase.from("payment_attempts").select("id, payment_id, phone_number, status, receipt_number, result_description, created_at").in("payment_id", paymentIds).order("created_at", { ascending: false })) : [];
    return (
      <div className="admin-page">
        <PageHeading {...heading} />
        <section className="admin-panel">
          <span className="admin-coming-icon" aria-hidden="true">＄</span>
          <p className="admin-eyebrow">DARAJA STK PUSH</p>
          <h2>Recent assignment collections</h2>
          <p>
            Payment records update after the verified M-PESA callback is received.
          </p>
          {payments.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Payment</th><th>Amount</th><th>Collection</th><th>Writer payout</th><th>Latest attempt</th><th>Receipt</th></tr></thead><tbody>{payments.map((payment) => { const attempt = attempts.find((item) => item.payment_id === payment.id); return <tr key={payment.id}><td><code className="admin-id">{payment.id.slice(0, 8)}</code></td><td>{payment.currency} {payment.amount.toLocaleString()}</td><td><StatusBadge status={payment.collection_status} /></td><td><StatusBadge status={payment.status} /></td><td>{attempt ? <>{attempt.status} · ••••{attempt.phone_number.slice(-4)} · {formatDate(attempt.created_at)}{attempt.result_description && <small className="admin-cell-subtitle">{attempt.result_description}</small>}</> : "No STK request"}</td><td>{payment.provider_reference ?? "—"}</td></tr>; })}</tbody></table></div> : <EmptyState title="No assignment payments yet." description="A payment record is created when an employer approves completed work." />}
          <Link className="admin-primary-link" href="/admin/settings">
            Review admin setup <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </div>
    );
  }

  if (section === "disputes") {
    const disputes = assertQuery("assignment disputes", await supabase.from("disputes").select("id, assignment_id, opened_by, reason, status, resolution, created_at").order("created_at", { ascending: false }).limit(100));
    const assignmentIds = [...new Set(disputes.map((dispute) => dispute.assignment_id))];
    const assignments = assignmentIds.length ? assertQuery("dispute assignments", await supabase.from("assignments").select("id, job_id, employer_id, writer_id").in("id", assignmentIds)) : [];
    const jobIds = [...new Set(assignments.map((assignment) => assignment.job_id))];
    const profileIds = [...new Set(assignments.flatMap((assignment) => [assignment.employer_id, assignment.writer_id]))];
    const [jobsResult, profilesResult] = await Promise.all([
      jobIds.length ? supabase.from("jobs").select("id, title").in("id", jobIds) : Promise.resolve({ data: [], error: null }),
      profileIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const jobs = assertQuery("dispute job titles", jobsResult);
    const people = assertQuery("dispute participants", profilesResult);
    const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
    const jobById = new Map(jobs.map((job) => [job.id, job]));
    const personById = new Map(people.map((person) => [person.id, person]));
    return <div className="admin-page"><PageHeading {...heading} /><section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">ASSIGNMENT RESOLUTION</p><h2>Recent disputes</h2></div><span className="admin-table-note">Latest 100 disputes</span></div>{disputes.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Assignment</th><th>Participants</th><th>Issue</th><th>Opened</th><th>Status and resolution</th></tr></thead><tbody>{disputes.map((dispute) => { const assignment = assignmentById.get(dispute.assignment_id); return <tr key={dispute.id}><td><strong>{jobById.get(assignment?.job_id ?? "")?.title ?? "Assignment"}</strong></td><td>{personById.get(assignment?.employer_id ?? "")?.full_name ?? "Employer"} ↔ {personById.get(assignment?.writer_id ?? "")?.full_name ?? "Writer"}</td><td>{dispute.reason}</td><td>{formatDate(dispute.created_at)}</td><td><DisputeStatusForm id={dispute.id} status={dispute.status} resolution={dispute.resolution} /></td></tr>; })}</tbody></table></div> : <EmptyState title="No disputes yet." description="Assignment disputes will appear here for administrator review." />}</section></div>;
  }

  if (section === "users") {
    const result = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const users = assertQuery("users", result);

    return (
      <div className="admin-page">
        <PageHeading {...heading} />
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">ACCOUNT DIRECTORY</p>
              <h2>Recently registered members</h2>
            </div>
            <span className="admin-table-note">Latest 50 accounts</span>
          </div>
          {users.length > 0 ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Account type</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Account ID</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
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
                      <td><span className={`admin-role-badge ${user.role}`}>{user.role}</span></td>
                      <td>{formatDate(user.created_at)}</td>
                      <td><code className="admin-id">{user.id.slice(0, 8)}…</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No member accounts yet." description="New registrations will appear here." />
          )}
        </section>
      </div>
    );
  }

  if (section === "jobs") {
    const result = await supabase
      .from("jobs")
      .select("id, title, category, budget_min, budget_max, currency, status, is_draft, created_at, employer_id")
      .eq("is_draft", false)
      .order("created_at", { ascending: false })
      .limit(50);
    const jobs = assertQuery("jobs", result);
    const employerIds = [...new Set(jobs.map((job) => job.employer_id))];
    const employerResult = employerIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", employerIds)
      : { data: [], error: null };
    const employers = assertQuery("job employers", employerResult);
    const employerById = new Map(employers.map((employer) => [employer.id, employer]));

    return (
      <div className="admin-page">
        <PageHeading {...heading} />
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">JOB MODERATION</p>
              <h2>Recent opportunities</h2>
            </div>
            <span className="admin-table-note">Latest 50 opportunities</span>
          </div>
          {jobs.length > 0 ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Opportunity</th>
                    <th scope="col">Employer</th>
                    <th scope="col">Budget</th>
                    <th scope="col">Posted</th>
                    <th scope="col">Status</th>
                    <th scope="col">Moderate</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const employer = employerById.get(job.employer_id);
                    return (
                      <tr key={job.id}>
                        <td>
                          <strong className="admin-cell-title">{job.title}</strong>
                          <small className="admin-cell-subtitle">{job.category}</small>
                        </td>
                        <td>{employer?.full_name ?? "Unknown employer"}</td>
                        <td>{formatBudget(job.budget_min, job.budget_max, job.currency)}</td>
                        <td>{formatDate(job.created_at)}</td>
                        <td><StatusBadge status={job.status} /></td>
                        <td>
                          <StatusForm
                            id={job.id}
                            kind="job"
                            status={job.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No job listings yet." description="New opportunities will appear here for review." />
          )}
        </section>
      </div>
    );
  }

  if (section === "applications") {
    const applicationResult = await supabase
      .from("applications")
      .select("id, job_id, writer_id, status, proposed_budget, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const applications = assertQuery("applications", applicationResult);
    const jobIds = [...new Set(applications.map((application) => application.job_id))];
    const writerIds = [...new Set(applications.map((application) => application.writer_id))];
    const [jobResult, writerResult] = await Promise.all([
      jobIds.length
        ? supabase.from("jobs").select("id, title").in("id", jobIds)
        : Promise.resolve({ data: [], error: null }),
      writerIds.length
        ? supabase.from("profiles").select("id, full_name, email").in("id", writerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const jobs = assertQuery("application jobs", jobResult);
    const writers = assertQuery("applicants", writerResult);
    const jobById = new Map(jobs.map((job) => [job.id, job]));
    const writerById = new Map(writers.map((writer) => [writer.id, writer]));

    return (
      <div className="admin-page">
        <PageHeading {...heading} />
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">APPLICATION REVIEW</p>
              <h2>Recent applications</h2>
            </div>
            <span className="admin-table-note">Latest 50 applications</span>
          </div>
          {applications.length > 0 ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Writer</th>
                    <th scope="col">Opportunity</th>
                    <th scope="col">Proposed budget</th>
                    <th scope="col">Applied</th>
                    <th scope="col">Status</th>
                    <th scope="col">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => {
                    const writer = writerById.get(application.writer_id);
                    const job = jobById.get(application.job_id);
                    return (
                      <tr key={application.id}>
                        <td>
                          <strong className="admin-cell-title">{writer?.full_name ?? "Unknown writer"}</strong>
                          <small className="admin-cell-subtitle">{writer?.email ?? ""}</small>
                        </td>
                        <td>{job?.title ?? "Unavailable listing"}</td>
                        <td>
                          {application.proposed_budget === null
                            ? "Not specified"
                            : formatBudget(
                                application.proposed_budget,
                                application.proposed_budget,
                                "KES",
                              )}
                        </td>
                        <td>{formatDate(application.created_at)}</td>
                        <td><StatusBadge status={application.status} /></td>
                        <td>
                          <StatusForm
                            id={application.id}
                            kind="application"
                            status={application.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No applications yet." description="Writer applications will appear here." />
          )}
        </section>
      </div>
    );
  }

  if (section === "reports") {
    const results = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "writer"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "employer"),
      supabase.from("jobs").select("id", { count: "exact", head: true }),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("applications").select("id", { count: "exact", head: true }),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "accepted"),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    const labels = [
      "Total registered users",
      "Writer accounts",
      "Employer accounts",
      "All job listings",
      "Approved listings",
      "Total applications",
      "Accepted applications",
      "Awaiting a decision",
    ];

    return (
      <div className="admin-page">
        <PageHeading {...heading} />
        <section className="admin-report-grid">
          {results.map((result, index) => {
            return (
              <article className="admin-report-card" key={labels[index]}>
                <span>{labels[index]}</span>
                <strong>{assertCount(labels[index], result).toLocaleString("en-KE")}</strong>
                <small>All-time record count</small>
              </article>
            );
          })}
        </section>
        <p className="admin-report-disclaimer">
          Counts reflect current database records. Revenue and payment reporting
          are unavailable until a payment provider is integrated.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeading {...heading} />
      <section className="admin-panel admin-settings-panel">
        <p className="admin-eyebrow">INITIAL ADMIN ACCESS</p>
        <h2>Grant admin access from Supabase</h2>
        <p>
          Create the manager account in Supabase under Authentication → Users.
          Then run this SQL in the Supabase SQL Editor to grant that account
          administrator access. Replace the email with the account email.
        </p>
        <pre className="admin-sql"><code>{`insert into private.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('you@example.com')
on conflict (user_id) do nothing;`}</code></pre>
        <p>
          To revoke admin access later, delete that user&apos;s row from
          <code> private.admin_users</code>. Admin access is never granted from
          the public signup form or browser.
        </p>
        <div className="admin-security-note">
          <span aria-hidden="true">🔒</span>
          <span>
            Only authenticated users listed in the private admin table can
            access this console. Database row-level security also enforces admin
            permissions for user, job, and application records.
          </span>
        </div>
      </section>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="admin-page-heading">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="admin-page-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="admin-empty">
      <span aria-hidden="true">◌</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
