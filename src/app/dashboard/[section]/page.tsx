import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplyToJobForm, WithdrawApplicationForm } from "@/app/dashboard/dashboard-forms";
import DashboardSidebar from "@/app/dashboard/dashboard-sidebar";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createReadOnlyClient } from "@/lib/supabase/server";
import type { ApplicationStatus, JobStatus } from "@/lib/supabase/database.types";

export const instant = false;

const sections = {
  jobs: { title: "Available", kicker: "OPEN OPPORTUNITIES", description: "Browse approved writing projects and apply to work that fits your skills." },
  available: { title: "Available", kicker: "OPEN OPPORTUNITIES", description: "Browse approved writing projects and apply to work that fits your skills." },
  new: { title: "New opportunities", kicker: "JUST POSTED", description: "Explore approved jobs you have not applied to yet." },
  "my-bids": { title: "My bids", kicker: "YOUR APPLICATIONS", description: "Keep track of the proposals you have sent to employers." },
  discarded: { title: "Discarded", kicker: "CLOSED APPLICATIONS", description: "Review applications that were declined or withdrawn." },
  invited: { title: "Invited", kicker: "EMPLOYER INVITATIONS", description: "Invitations from employers will appear here." },
  "private-available": { title: "Private available", kicker: "PRIVATE OPPORTUNITIES", description: "Private opportunities shared with you will appear here." },
  "in-progress": { title: "In progress", kicker: "ACTIVE WORK", description: "Follow the progress of assignments you have accepted." },
  "in-review": { title: "In review", kicker: "AWAITING REVIEW", description: "Track applications and assignments currently under review." },
  completed: { title: "Completed", kicker: "YOUR WORK HISTORY", description: "Completed assignments and delivery records will appear here." },
  revision: { title: "Revision", kicker: "REVISION REQUESTS", description: "Work returned for revision will appear here." },
  canceled: { title: "Canceled", kicker: "CANCELED WORK", description: "Canceled assignments and their status will appear here." },
  disputed: { title: "Disputed", kicker: "DISPUTES", description: "Dispute updates and resolution details will appear here." },
  profile: { title: "Profile", kicker: "YOUR ACCOUNT", description: "Manage how your writer profile appears to employers." },
  rating: { title: "Rating", kicker: "YOUR REPUTATION", description: "Your employer feedback and writer rating will appear here." },
  chat: { title: "General chat", kicker: "COMMUNITY", description: "Join conversations with the Accurate Writers community." },
  transactions: { title: "Transactions", kicker: "PAYMENT HISTORY", description: "Review your account transactions and payment records." },
  fines: { title: "Fines", kicker: "ACCOUNT FEES", description: "Any account fines or adjustments will be listed here." },
  subscriptions: { title: "Subscriptions", kicker: "MEMBERSHIP", description: "View and manage your writer subscription." },
  "untrusted-employers": { title: "Untrusted employers", kicker: "SAFETY", description: "Review employer safety notices shared with the writer community." },
  news: { title: "News", kicker: "PLATFORM UPDATES", description: "Read the latest Accurate Writers announcements." },
  faq: { title: "FAQ", kicker: "HELP CENTER", description: "Find answers to common questions about working on Accurate Writers." },
  rules: { title: "Rules & Regulations", kicker: "GUIDELINES", description: "Review the standards that keep the marketplace fair and reliable." },
  applications: { title: "My applications", kicker: "YOUR ACTIVITY", description: "Track the progress of every application you have submitted." },
  articles: { title: "My articles", kicker: "YOUR PORTFOLIO", description: "Your completed writing assignments will be collected here." },
  payments: { title: "Payments", kicker: "EARNINGS", description: "Payment tracking will appear here when payments are connected." },
  settings: { title: "Settings", kicker: "PREFERENCES", description: "Account preferences and notification controls will live here." },
} as const;

const applicationSections = ["my-bids", "discarded", "in-progress", "in-review"] as const;

function formatBudget(min: number, max: number, currency: string) {
  const format = (amount: number) => `${currency} ${amount.toLocaleString("en", { maximumFractionDigits: 0 })}`;
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" }) : "Flexible";
}

function StatusBadge({ status }: { status: JobStatus | ApplicationStatus }) {
  return <span className={`dashboard-status status-${status}`}>{status.replaceAll("_", " ")}</span>;
}

export default async function WriterSectionPage({ params }: PageProps<"/dashboard/[section]">) {
  const { section } = await params;
  if (!Object.hasOwn(sections, section)) notFound();
  const key = section as keyof typeof sections;
  const current = sections[key];
  const config = getSupabaseConfig();
  if (!config.configured) {
    return <main className="dashboard-page"><section className="dashboard-card"><p className="section-kicker">BACKEND SETUP</p><h1>Connect your Supabase project</h1><p>{config.message}</p><Link className="button" href="/">Back to Accurate Writers</Link></section></main>;
  }

  const supabase = await createReadOnlyClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) throw new Error(`Could not verify the Supabase session: ${claimsError.message}`);
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/register?mode=login");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name, role").eq("id", userId).single();
  if (profileError) throw new Error(`Could not load your profile: ${profileError.message}`);
  if (profile.role !== "writer") redirect("/dashboard");

  const [jobsResult, applicationsResult] = await Promise.all([
    supabase.from("jobs").select("id, title, description, category, budget_min, budget_max, currency, word_count, deadline, created_at").eq("status", "approved").order("created_at", { ascending: false }).limit(50),
    supabase.from("applications").select("id, job_id, status, proposed_budget, created_at").eq("writer_id", userId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (jobsResult.error) throw new Error(`Could not load approved jobs: ${jobsResult.error.message}`);
  if (applicationsResult.error) throw new Error(`Could not load your applications: ${applicationsResult.error.message}`);
  const jobs = jobsResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const visibleApplications = key === "discarded"
    ? applications.filter((application) => ["rejected", "withdrawn"].includes(application.status))
    : key === "in-progress"
      ? applications.filter((application) => application.status === "accepted")
      : key === "in-review" || key === "my-bids"
        ? applications.filter((application) => ["pending", "shortlisted"].includes(application.status))
        : applications;
  const jobIds = [...new Set(applications.map((application) => application.job_id))];
  const appliedJobsResult = jobIds.length ? await supabase.from("jobs").select("id, title, currency").in("id", jobIds) : { data: [], error: null };
  if (appliedJobsResult.error) throw new Error(`Could not load application job titles: ${appliedJobsResult.error.message}`);
  const appliedJobs = new Map((appliedJobsResult.data ?? []).map((job) => [job.id, job]));
  const appliedIds = new Set(applications.map((application) => application.job_id));
  const visibleJobs = key === "new"
    ? jobs.filter((job) => !appliedIds.has(job.id))
    : jobs;
  const isApplicationPage = key === "applications" ||
    applicationSections.some((applicationSection) => applicationSection === key);

  return (
    <div className="dashboard-app-shell role-writer">
      <DashboardSidebar role="writer" />
      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-crumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{current.title}</strong></div>
          <div className="dashboard-account"><span className="dashboard-account-avatar" aria-hidden="true">{profile.full_name.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-account-name"><strong>{profile.full_name}</strong><small>Writer</small></span></div>
        </header>
        <section className="dashboard-content">
          <div className="dashboard-welcome"><div><p className="section-kicker">{current.kicker}</p><h1>{current.title}</h1><p className="dashboard-intro">{current.description}</p></div><span className="dashboard-role-pill">Writer workspace</span></div>
          {(key === "jobs" || key === "available" || key === "new") && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <p className="dashboard-eyebrow">FIND YOUR NEXT PROJECT</p>
                  <h2>{key === "new" ? "New opportunities" : "Available writing jobs"}</h2>
                </div>
                <span className="dashboard-count">{visibleJobs.length} open</span>
              </div>
              {visibleJobs.length ? (
                <div className="dashboard-list">
                  {visibleJobs.map((job) => (
                    <article className="dashboard-listing" key={job.id}>
                      <div className="dashboard-listing-heading">
                        <div>
                          <span className="dashboard-category">{job.category}</span>
                          <h3>{job.title}</h3>
                        </div>
                        <strong className="dashboard-budget">
                          {formatBudget(job.budget_min, job.budget_max, job.currency)}
                        </strong>
                      </div>
                      <p className="dashboard-description">{job.description}</p>
                      <div className="dashboard-listing-meta">
                        <span>{job.word_count ? `${job.word_count.toLocaleString()} words` : "Word count flexible"}</span>
                        <span>Deadline: {formatDate(job.deadline)}</span>
                        <span>Posted {formatDate(job.created_at)}</span>
                      </div>
                      {appliedIds.has(job.id) ? (
                        <span className="dashboard-applied-label">Application submitted</span>
                      ) : (
                        <ApplyToJobForm currency={job.currency} jobId={job.id} />
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">
                  <h3>{key === "new" ? "You are all caught up" : "No approved jobs available yet"}</h3>
                  <p>{key === "new" ? "You have already applied to every currently available job." : "New opportunities will appear here as soon as employers post them and they are approved."}</p>
                </div>
              )}
            </section>
          )}

          {isApplicationPage && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <p className="dashboard-eyebrow">{current.kicker}</p>
                  <h2>{current.title}</h2>
                </div>
                <span className="dashboard-count">{visibleApplications.length} total</span>
              </div>
              {visibleApplications.length ? (
                <div className="dashboard-application-list">
                  {visibleApplications.map((application) => (
                    <article className="dashboard-application" key={application.id}>
                      <div>
                        <h3>{appliedJobs.get(application.job_id)?.title ?? "Job listing no longer available"}</h3>
                        <p>Applied {formatDate(application.created_at)}</p>
                        {application.proposed_budget !== null && (
                          <p>
                            Proposed {formatBudget(
                              application.proposed_budget,
                              application.proposed_budget,
                              appliedJobs.get(application.job_id)?.currency ?? "KES",
                            )}
                          </p>
                        )}
                      </div>
                      <div className="dashboard-application-actions">
                        <StatusBadge status={application.status} />
                        {application.status === "pending" && (
                          <WithdrawApplicationForm applicationId={application.id} />
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">
                  <h3>Nothing to show here yet</h3>
                  <p>{current.description}</p>
                  <Link className="button" href="/dashboard/new">Browse new opportunities</Link>
                </div>
              )}
            </section>
          )}

          {!isApplicationPage && !(key === "jobs" || key === "available" || key === "new") && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-empty">
                <span className="dashboard-empty-mark" aria-hidden="true">i</span>
                <h2>{key === "profile" ? profile.full_name : current.title}</h2>
                <p>{current.description}</p>
                <p className="dashboard-form-note">
                  This module is ready in the workspace, but its account data is not connected yet.
                </p>
                {key === "invited" || key === "private-available" ? (
                  <Link className="button" href="/dashboard/new">Browse public opportunities</Link>
                ) : null}
              </div>
            </section>
          )}        </section>
      </main>
    </div>
  );
}
