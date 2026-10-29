import { redirect } from "next/navigation";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import {
  ApplyToJobForm,
  CloseJobForm,
  CreateJobForm,
  ReviewApplicationForm,
  WithdrawApplicationForm,
} from "@/app/dashboard/dashboard-forms";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type {
  AccountRole,
  ApplicationStatus,
  JobStatus,
} from "@/lib/supabase/database.types";
import { createReadOnlyClient } from "@/lib/supabase/server";

export const instant = false;

const roleLabels: Record<AccountRole, string> = {
  employer: "Employer",
  writer: "Writer",
};

function formatBudget(min: number, max: number, currency: string): string {
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }

    const formattedMin = min.toLocaleString("en");
    const formattedMax = max.toLocaleString("en");
    return min === max
      ? `${currency} ${formattedMin}`
      : `${currency} ${formattedMin}–${formattedMax}`;
  }
  if (min === max) {
    return formatter.format(min);
  }
  return `${formatter.format(min)}–${formatter.format(max)}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not specified";
  }
  return new Date(value).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ status }: { status: JobStatus | ApplicationStatus }) {
  return (
    <span className={`dashboard-status status-${status}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function PageHeading({
  role,
  fullName,
}: {
  role: AccountRole;
  fullName: string;
}) {
  return (
    <>
      <p className="section-kicker">{roleLabels[role]} DASHBOARD</p>
      <h1>Welcome, {fullName}.</h1>
      <p className="dashboard-intro">
        {role === "writer"
          ? "Find writing opportunities, track your applications, and connect with clients."
          : "Post writing projects, review applicants, and manage your opportunities."}
      </p>
    </>
  );
}

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
          <Link className="button" href="/">Back to Accurate Writers</Link>
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

  const writerData = profile.role === "writer"
    ? await Promise.all([
        supabase
          .from("jobs")
          .select("id, title, description, category, budget_min, budget_max, currency, word_count, deadline, created_at")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("applications")
          .select("id, job_id, status, proposed_budget, created_at")
          .eq("writer_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
      ])
    : null;

  if (writerData?.[0].error) {
    throw new Error(`Could not load approved jobs: ${writerData[0].error.message}`);
  }
  if (writerData?.[1].error) {
    throw new Error(`Could not load your applications: ${writerData[1].error.message}`);
  }

  const writerJobs = writerData?.[0].data ?? [];
  const writerApplications = writerData?.[1].data ?? [];
  const appliedJobIds = new Set(writerApplications.map((application) => application.job_id));
  const writerJobIds = [...new Set(writerApplications.map((application) => application.job_id))];
  const { data: appliedJobs, error: appliedJobsError } = writerJobIds.length
    ? await supabase.from("jobs").select("id, title, currency").in("id", writerJobIds)
    : { data: [], error: null };
  if (appliedJobsError) {
    throw new Error(`Could not load application job titles: ${appliedJobsError.message}`);
  }
  const writerJobById = new Map((appliedJobs ?? []).map((job) => [job.id, job]));

  const employerJobsResult = profile.role === "employer"
    ? await supabase
        .from("jobs")
        .select("id, title, description, category, budget_min, budget_max, currency, word_count, deadline, status, created_at")
        .eq("employer_id", userId)
        .order("created_at", { ascending: false })
        .limit(50)
    : null;

  if (employerJobsResult?.error) {
    throw new Error(`Could not load your job listings: ${employerJobsResult.error.message}`);
  }

  const employerJobs = employerJobsResult?.data ?? [];
  const employerJobIds = employerJobs.map((job) => job.id);
  const employerApplicationsResult = employerJobIds.length
    ? await supabase
        .from("applications")
        .select("id, job_id, writer_id, cover_letter, proposed_budget, status, created_at")
        .in("job_id", employerJobIds)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };

  if (employerApplicationsResult.error) {
    throw new Error(
      `Could not load applicants for your jobs: ${employerApplicationsResult.error.message}`,
    );
  }

  const employerApplications = employerApplicationsResult.data ?? [];
  const writerIds = [...new Set(employerApplications.map((application) => application.writer_id))];
  const applicantsResult = writerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", writerIds)
    : { data: [], error: null };

  if (applicantsResult.error) {
    throw new Error(`Could not load applicant profiles: ${applicantsResult.error.message}`);
  }

  const applicantNames = new Map(
    (applicantsResult.data ?? []).map((applicant) => [applicant.id, applicant.full_name]),
  );
  const hasApplicantProfileAccessGap = employerApplications.some(
    (application) => !applicantNames.has(application.writer_id),
  );
  const employerJobTitles = new Map(employerJobs.map((job) => [job.id, job.title]));

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
        <PageHeading fullName={profile.full_name} role={profile.role} />

        <div className="dashboard-metrics">
          {profile.role === "writer" ? (
            <>
              <article>
                <span>AVAILABLE JOBS</span>
                <strong>{writerJobs.length}</strong>
                <small>Approved opportunities</small>
              </article>
              <article>
                <span>MY APPLICATIONS</span>
                <strong>{writerApplications.length}</strong>
                <small>Submitted applications</small>
              </article>
              <article>
                <span>ACCEPTED</span>
                <strong>{writerApplications.filter((application) => application.status === "accepted").length}</strong>
                <small>Applications accepted</small>
              </article>
            </>
          ) : (
            <>
              <article>
                <span>MY JOBS</span>
                <strong>{employerJobs.length}</strong>
                <small>Listings you have posted</small>
              </article>
              <article>
                <span>APPLICANTS</span>
                <strong>{employerApplications.length}</strong>
                <small>Applications received</small>
              </article>
              <article>
                <span>AWAITING REVIEW</span>
                <strong>{employerApplications.filter((application) => application.status === "pending").length}</strong>
                <small>Pending applications</small>
              </article>
            </>
          )}
        </div>

        {profile.role === "writer" ? (
          <div className="dashboard-sections">
            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <p className="dashboard-eyebrow">FIND YOUR NEXT PROJECT</p>
                  <h2>Writing opportunities</h2>
                </div>
                <span className="dashboard-count">{writerJobs.length} open</span>
              </div>
              {writerJobs.length ? (
                <div className="dashboard-list">
                  {writerJobs.map((job) => {
                    const hasApplied = appliedJobIds.has(job.id);
                    return (
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
                        {hasApplied ? (
                          <span className="dashboard-applied-label">Application submitted</span>
                        ) : (
                          <ApplyToJobForm currency={job.currency} jobId={job.id} />
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="dashboard-empty">
                  <h3>No approved jobs available yet</h3>
                  <p>New opportunities will appear here as soon as employers post them and they are approved.</p>
                </div>
              )}
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <p className="dashboard-eyebrow">KEEP TRACK</p>
                  <h2>Your applications</h2>
                </div>
                <span className="dashboard-count">{writerApplications.length} total</span>
              </div>
              {writerApplications.length ? (
                <div className="dashboard-application-list">
                  {writerApplications.map((application) => (
                    <article className="dashboard-application" key={application.id}>
                      <div>
                        <h3>{writerJobById.get(application.job_id)?.title ?? "Job listing no longer available"}</h3>
                        <p>Applied {formatDate(application.created_at)}</p>
                        {application.proposed_budget !== null && (
                          <p>
                            Proposed{" "}
                            {formatBudget(
                              application.proposed_budget,
                              application.proposed_budget,
                              writerJobById.get(application.job_id)?.currency ?? "KES",
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
                <div className="dashboard-empty compact">
                  <p>You haven&apos;t applied to a job yet. Browse the approved opportunities above to get started.</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="dashboard-sections">
            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <p className="dashboard-eyebrow">CREATE AN OPPORTUNITY</p>
                  <h2>Post a writing job</h2>
                </div>
              </div>
              <CreateJobForm />
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <p className="dashboard-eyebrow">YOUR LISTINGS</p>
                  <h2>Manage jobs</h2>
                </div>
                <span className="dashboard-count">{employerJobs.length} total</span>
              </div>
              {employerJobs.length ? (
                <div className="dashboard-list">
                  {employerJobs.map((job) => (
                    <article className="dashboard-listing" key={job.id}>
                      <div className="dashboard-listing-heading">
                        <div>
                          <span className="dashboard-category">{job.category}</span>
                          <h3>{job.title}</h3>
                        </div>
                        <div className="dashboard-application-actions">
                          <StatusBadge status={job.status} />
                          {["pending", "approved"].includes(job.status) && (
                            <CloseJobForm jobId={job.id} />
                          )}
                        </div>
                      </div>
                      <p className="dashboard-description">{job.description}</p>
                      <div className="dashboard-listing-meta">
                        <span>{formatBudget(job.budget_min, job.budget_max, job.currency)}</span>
                        <span>{job.word_count ? `${job.word_count.toLocaleString()} words` : "Word count flexible"}</span>
                        <span>Deadline: {formatDate(job.deadline)}</span>
                        <span>{employerApplications.filter((application) => application.job_id === job.id).length} applicants</span>
                      </div>
                      {job.status === "pending" && (
                        <p className="dashboard-moderation-note">Waiting for administrator approval before writers can see this listing.</p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">
                  <h3>Your next great hire starts with a clear brief</h3>
                  <p>Post a writing job above. You can track its approval status and review applications here.</p>
                </div>
              )}
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel-heading">
                <div>
                  <p className="dashboard-eyebrow">REVIEW CANDIDATES</p>
                  <h2>Applications received</h2>
                </div>
                <span className="dashboard-count">{employerApplications.length} total</span>
              </div>
              {hasApplicantProfileAccessGap && (
                <p className="auth-notice dashboard-setup-notice" role="status">
                  Apply the <code>20261029000002_employer_applicant_profiles.sql</code> migration
                  in Supabase to display applicant names.
                </p>
              )}
              {employerApplications.length ? (
                <div className="dashboard-application-list">
                  {employerApplications.map((application) => (
                    <article className="dashboard-applicant" key={application.id}>
                      <div className="dashboard-applicant-heading">
                        <div>
                          <h3>{applicantNames.get(application.writer_id) ?? "Writer applicant"}</h3>
                          <p>
                            Applied to <strong>{employerJobTitles.get(application.job_id) ?? "your job"}</strong>
                            {" · "}{formatDate(application.created_at)}
                          </p>
                        </div>
                        <StatusBadge status={application.status} />
                      </div>
                      <p className="dashboard-cover-letter">{application.cover_letter}</p>
                      <div className="dashboard-applicant-footer">
                        <span>
                          Proposed budget:{" "}
                          {application.proposed_budget === null
                            ? "Not specified"
                            : formatBudget(
                                application.proposed_budget,
                                application.proposed_budget,
                                employerJobs.find((job) => job.id === application.job_id)?.currency ?? "KES",
                              )}
                        </span>
                        {application.status !== "withdrawn" && (
                          <ReviewApplicationForm
                            applicationId={application.id}
                            status={application.status}
                          />
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty compact">
                  <p>Applications will appear here when writers apply to your approved listings.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
