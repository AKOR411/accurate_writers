import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplyToJobForm, WithdrawApplicationForm } from "@/app/dashboard/dashboard-forms";
import DashboardSidebar from "@/app/dashboard/dashboard-sidebar";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createReadOnlyClient } from "@/lib/supabase/server";
import type { ApplicationStatus, JobStatus } from "@/lib/supabase/database.types";

const sections = {
  jobs: { title: "Find jobs", kicker: "OPPORTUNITIES", description: "Browse approved writing projects and apply to work that fits your skills." },
  applications: { title: "My applications", kicker: "YOUR ACTIVITY", description: "Track the progress of every application you have submitted." },
  articles: { title: "My articles", kicker: "YOUR PORTFOLIO", description: "Your completed writing assignments will be collected here." },
  payments: { title: "Payments", kicker: "EARNINGS", description: "Payment tracking will appear here when payments are connected." },
  profile: { title: "Profile", kicker: "YOUR ACCOUNT", description: "Manage how your writer profile appears to employers." },
  settings: { title: "Settings", kicker: "PREFERENCES", description: "Account preferences and notification controls will live here." },
} as const;

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
  if (!(section in sections)) notFound();
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
  const jobIds = [...new Set(applications.map((application) => application.job_id))];
  const appliedJobsResult = jobIds.length ? await supabase.from("jobs").select("id, title, currency").in("id", jobIds) : { data: [], error: null };
  if (appliedJobsResult.error) throw new Error(`Could not load application job titles: ${appliedJobsResult.error.message}`);
  const appliedJobs = new Map((appliedJobsResult.data ?? []).map((job) => [job.id, job]));
  const appliedIds = new Set(applications.map((application) => application.job_id));

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
          {key === "jobs" && <section className="dashboard-panel dashboard-section-panel"><div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">FIND YOUR NEXT PROJECT</p><h2>Available writing jobs</h2></div><span className="dashboard-count">{jobs.length} open</span></div>{jobs.length ? <div className="dashboard-list">{jobs.map((job) => <article className="dashboard-listing" key={job.id}><div className="dashboard-listing-heading"><div><span className="dashboard-category">{job.category}</span><h3>{job.title}</h3></div><strong className="dashboard-budget">{formatBudget(job.budget_min, job.budget_max, job.currency)}</strong></div><p className="dashboard-description">{job.description}</p><div className="dashboard-listing-meta"><span>{job.word_count ? `${job.word_count.toLocaleString()} words` : "Word count flexible"}</span><span>Deadline: {formatDate(job.deadline)}</span><span>Posted {formatDate(job.created_at)}</span></div>{appliedIds.has(job.id) ? <span className="dashboard-applied-label">Application submitted</span> : <ApplyToJobForm currency={job.currency} jobId={job.id} />}</article>)}</div> : <div className="dashboard-empty"><h3>No approved jobs available yet</h3><p>New opportunities will appear here as soon as employers post them and they are approved.</p></div>}</section>}
          {key === "applications" && <section className="dashboard-panel dashboard-section-panel"><div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">KEEP TRACK</p><h2>Your applications</h2></div><span className="dashboard-count">{applications.length} total</span></div>{applications.length ? <div className="dashboard-application-list">{applications.map((application) => <article className="dashboard-application" key={application.id}><div><h3>{appliedJobs.get(application.job_id)?.title ?? "Job listing no longer available"}</h3><p>Applied {formatDate(application.created_at)}</p>{application.proposed_budget !== null && <p>Proposed {formatBudget(application.proposed_budget, application.proposed_budget, appliedJobs.get(application.job_id)?.currency ?? "KES")}</p>}</div><div className="dashboard-application-actions"><StatusBadge status={application.status} />{application.status === "pending" && <WithdrawApplicationForm applicationId={application.id} />}</div></article>)}</div> : <div className="dashboard-empty"><h3>No applications yet</h3><p>Explore available opportunities and submit an application when you find a good fit.</p><Link className="button" href="/dashboard/jobs">Browse jobs</Link></div>}</section>}
          {key !== "jobs" && key !== "applications" && <section className="dashboard-panel dashboard-section-panel"><div className="dashboard-empty"><span className="dashboard-empty-mark" aria-hidden="true">✦</span><h2>{key === "articles" ? "Your portfolio starts with your first assignment" : key === "payments" ? "Your earnings will be easy to track" : key === "profile" ? "Your writer profile is being prepared" : "Your workspace preferences are coming soon"}</h2><p>{key === "articles" ? "Once you complete assignments through Accurate Writers, your published and delivered work will appear here." : key === "payments" ? "When payment processing is connected, you’ll find balances, payment history, and transaction details here." : key === "profile" ? "Profile editing is being prepared. Your account name is currently shown as " + profile.full_name + "." : "We’re preparing account and notification controls for your workspace."}</p>{key === "articles" && <Link className="button" href="/dashboard/jobs">Explore writing jobs</Link>}</div></section>}
        </section>
      </main>
    </div>
  );
}
