import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApplyToJobForm, AssignmentDisputeForm, AssignmentReviewForm, DashboardMessageForm, OfferResponseForm, WithdrawApplicationForm, WriterProfileForm } from "@/app/dashboard/dashboard-forms";
import DashboardSidebar from "@/app/dashboard/dashboard-sidebar";
import DashboardNotificationBell from "@/app/dashboard/dashboard-notification-bell";
import AssignmentSubmissionForm from "@/app/dashboard/assignment-submission-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createReadOnlyClient } from "@/lib/supabase/server";
import type { ApplicationStatus, JobStatus } from "@/lib/supabase/database.types";

export const instant = false;

const sections = {
  jobs: { title: "Available", kicker: "OPEN OPPORTUNITIES", description: "Browse approved writing projects and apply to work that fits your skills." },
  offers: { title: "Job offers", kicker: "OFFERS", description: "Review offers from employers and choose whether to accept or decline." },
  assignments: { title: "My assignments", kicker: "ACTIVE WORK", description: "Manage accepted assignments, deadlines, submissions, and revisions." },
  available: { title: "Available", kicker: "OPEN OPPORTUNITIES", description: "Browse approved writing projects and apply to work that fits your skills." },
  new: { title: "New opportunities", kicker: "JUST POSTED", description: "Explore approved jobs you have not applied to yet." },
  "my-bids": { title: "My bids", kicker: "YOUR APPLICATIONS", description: "Keep track of the proposals you have sent to employers." },
  discarded: { title: "Discarded", kicker: "CLOSED APPLICATIONS", description: "Review applications that were declined or withdrawn." },
  invited: { title: "Invited", kicker: "EMPLOYER INVITATIONS", description: "Invitations from employers will appear here." },
  "private-available": { title: "Private available", kicker: "PRIVATE OPPORTUNITIES", description: "Private opportunities shared with you will appear here." },
  "in-progress": { title: "In progress", kicker: "ACTIVE WORK", description: "Follow the progress of assignments you have accepted." },
  "in-review": { title: "In review", kicker: "AWAITING REVIEW", description: "Track applications and assignments currently under review." },
  completed: { title: "Completed", kicker: "YOUR WORK HISTORY", description: "Completed assignments and delivery records will appear here." },
  "pending-payment": { title: "Pending payment", kicker: "COMPLETED WORK", description: "Completed assignments awaiting payment will appear here." },
  paid: { title: "Paid", kicker: "PAYMENT HISTORY", description: "Completed assignments with confirmed payment will appear here." },
  revision: { title: "Revision", kicker: "REVISION REQUESTS", description: "Work returned for revision will appear here." },
  canceled: { title: "Canceled", kicker: "CANCELED WORK", description: "Canceled assignments and their status will appear here." },
  disputed: { title: "Disputed", kicker: "DISPUTES", description: "Dispute updates and resolution details will appear here." },
  profile: { title: "Profile", kicker: "YOUR ACCOUNT", description: "Manage how your writer profile appears to employers." },
  rating: { title: "Rating", kicker: "YOUR REPUTATION", description: "Your employer feedback and writer rating will appear here." },
  chat: { title: "General chat", kicker: "COMMUNITY", description: "Join conversations with the Accurate Writers community." },
  transactions: { title: "Transactions", kicker: "PAYMENT HISTORY", description: "Review your account transactions and payment records." },
  fines: { title: "Fines", kicker: "ACCOUNT FEES", description: "Any account fines or adjustments will be listed here." },
  subscriptions: { title: "Subscriptions", kicker: "MEMBERSHIP", description: "View subscription plans and manage your membership." },
  subscribe: { title: "Subscribe", kicker: "MEMBERSHIP", description: "Explore membership options for your writer account." },
  "active-subscriptions": { title: "Active subscriptions", kicker: "YOUR MEMBERSHIP", description: "Review your current plan, renewal details, and subscription history." },
  "untrusted-employers": { title: "Untrusted employers", kicker: "SAFETY", description: "Review employer safety notices shared with the writer community." },
  news: { title: "News", kicker: "PLATFORM UPDATES", description: "Read the latest Accurate Writers announcements." },
  faq: { title: "FAQ", kicker: "HELP CENTER", description: "Find answers to common questions about working on Accurate Writers." },
  rules: { title: "Rules & Regulations", kicker: "GUIDELINES", description: "Review the standards that keep the marketplace fair and reliable." },
  applications: { title: "My applications", kicker: "YOUR ACTIVITY", description: "Track the progress of every application you have submitted." },
  articles: { title: "My articles", kicker: "YOUR PORTFOLIO", description: "Your completed writing assignments will be collected here." },
  payments: { title: "Payments", kicker: "EARNINGS", description: "Payment tracking will appear here when payments are connected." },
  settings: { title: "Settings", kicker: "PREFERENCES", description: "Account preferences and notification controls will live here." },
} as const;

const applicationSections = ["my-bids", "discarded", "in-review"] as const;

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
  const { data: profile, error: profileError } = await supabase.from("profiles").select("full_name, role, bio, skills, portfolio_url").eq("id", userId).single();
  if (profileError) throw new Error(`Could not load your profile: ${profileError.message}`);
  if (profile.role !== "writer") redirect("/dashboard");
  const { data: notifications, error: notificationsError } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (notificationsError) throw new Error(`Could not load notifications: ${notificationsError.message}`);

  const [jobsResult, applicationsResult, offersResult, assignmentsResult, paymentsResult, messagesResult] = await Promise.all([
    supabase.from("jobs").select("id, employer_id, title, description, category, budget_min, budget_max, currency, word_count, deadline, created_at").eq("status", "approved").eq("is_draft", false).is("filled_at", null).order("created_at", { ascending: false }).limit(50),
    supabase.from("applications").select("id, job_id, status, proposed_budget, experience_summary, created_at").eq("writer_id", userId).order("created_at", { ascending: false }).limit(100),
    supabase.from("job_offers").select("id, job_id, application_id, amount, currency, instructions, status, expires_at, created_at").eq("writer_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("assignments").select("id, job_id, offer_id, employer_id, agreed_amount, currency, instructions, deadline, status, accepted_at, completed_at").eq("writer_id", userId).order("created_at", { ascending: false }).limit(100),
    supabase.from("payments").select("id, assignment_id, amount, currency, status, collection_status, collection_confirmed_at, provider_reference, confirmed_at, created_at").eq("writer_id", userId).order("created_at", { ascending: false }).limit(100),
    supabase.from("messages").select("id, assignment_id, job_id, sender_id, recipient_id, body, read_at, created_at").or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).order("created_at", { ascending: false }).limit(100),
  ]);
  if (jobsResult.error) throw new Error(`Could not load approved jobs: ${jobsResult.error.message}`);
  if (applicationsResult.error) throw new Error(`Could not load your applications: ${applicationsResult.error.message}`);
  if (offersResult.error) throw new Error(`Could not load your offers: ${offersResult.error.message}`);
  if (assignmentsResult.error) throw new Error(`Could not load your assignments: ${assignmentsResult.error.message}`);
  if (paymentsResult.error) throw new Error(`Could not load your payments: ${paymentsResult.error.message}`);
  if (messagesResult.error) throw new Error(`Could not load your messages: ${messagesResult.error.message}`);
  const jobs = jobsResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const offers = offersResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const messages = messagesResult.data ?? [];
  const visibleApplications = key === "discarded"
    ? applications.filter((application) => ["rejected", "withdrawn"].includes(application.status))
    : key === "in-review" || key === "my-bids"
        ? applications.filter((application) => ["pending", "shortlisted"].includes(application.status))
        : applications;
  const jobIds = [...new Set(applications.map((application) => application.job_id))];
  const appliedJobsResult = jobIds.length ? await supabase.from("jobs").select("id, title, currency, employer_id").in("id", jobIds) : { data: [], error: null };
  if (appliedJobsResult.error) throw new Error(`Could not load application job titles: ${appliedJobsResult.error.message}`);
  const appliedJobs = new Map((appliedJobsResult.data ?? []).map((job) => [job.id, job]));
  const employerIds = [...new Set([
    ...jobs.map((job) => job.employer_id),
    ...assignments.map((assignment) => assignment.employer_id),
    ...(appliedJobsResult.data ?? []).map((job) => job.employer_id),
  ])];
  const employersResult = employerIds.length
    ? await supabase.from("profiles").select("id, full_name, bio, skills, portfolio_url").in("id", employerIds)
    : { data: [], error: null };
  if (employersResult.error) throw new Error(`Could not load employer profiles: ${employersResult.error.message}`);
  const employerProfiles = new Map((employersResult.data ?? []).map((employer) => [employer.id, employer]));
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const [disputesResult, reviewsResult] = assignmentIds.length ? await Promise.all([
    supabase.from("disputes").select("id, assignment_id, opened_by, reason, status, created_at").in("assignment_id", assignmentIds).order("created_at", { ascending: false }),
    supabase.from("reviews").select("id, assignment_id, reviewer_id, reviewee_id, rating, comment, created_at").in("assignment_id", assignmentIds).order("created_at", { ascending: false }),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (disputesResult.error) throw new Error(`Could not load disputes: ${disputesResult.error.message}`);
  if (reviewsResult.error) throw new Error(`Could not load reviews: ${reviewsResult.error.message}`);
  const disputes = disputesResult.data ?? [];
  const reviews = reviewsResult.data ?? [];
  const submissionsResult = assignmentIds.length
    ? await supabase.from("work_submissions").select("id, assignment_id, version, storage_path, file_name, file_size, comments, status, review_notes, created_at").in("assignment_id", assignmentIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (submissionsResult.error) throw new Error(`Could not load your submissions: ${submissionsResult.error.message}`);
  const submissions = submissionsResult.data ?? [];
  const submissionLinks = new Map(await Promise.all(submissions.map(async (submission) => {
    const { data, error } = await supabase.storage.from("work-submissions").createSignedUrl(submission.storage_path, 60);
    return [submission.id, error ? null : data.signedUrl] as const;
  })));
  const assignmentJobsResult = assignments.length
    ? await supabase.from("jobs").select("id, title, description, category, word_count").in("id", assignments.map((assignment) => assignment.job_id))
    : { data: [], error: null };
  if (assignmentJobsResult.error) throw new Error(`Could not load assignment details: ${assignmentJobsResult.error.message}`);
  const assignmentJobs = new Map((assignmentJobsResult.data ?? []).map((job) => [job.id, job]));
  const conversations = new Map<string, { assignmentId?: string; jobId?: string; recipientId: string; name: string }>();
  for (const assignment of assignments) {
    conversations.set(`assignment:${assignment.id}`, {
      assignmentId: assignment.id,
      recipientId: assignment.employer_id,
      name: employerProfiles.get(assignment.employer_id)?.full_name ?? "Employer",
    });
  }
  for (const application of applications) {
    const job = appliedJobs.get(application.job_id);
    if (job) conversations.set(`job:${job.id}`, {
      jobId: job.id,
      recipientId: job.employer_id,
      name: employerProfiles.get(job.employer_id)?.full_name ?? "Employer",
    });
  }
  const appliedIds = new Set(applications.map((application) => application.job_id));
  const visibleJobs = key === "new"
    ? jobs.filter((job) => !appliedIds.has(job.id))
    : jobs;
  const isApplicationPage = key === "applications" ||
    applicationSections.some((applicationSection) => applicationSection === key);
  const visibleAssignments = assignments.filter((assignment) => key === "completed"
    ? assignment.status === "completed"
    : key === "canceled"
      ? assignment.status === "cancelled"
      : key === "revision"
        ? assignment.status === "revision_requested"
        : key === "in-review"
          ? assignment.status === "submitted_for_review"
          : assignment.status !== "completed" && assignment.status !== "cancelled");

  return (
    <div className="dashboard-app-shell role-writer">
      <DashboardSidebar role="writer" />
      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-crumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{current.title}</strong></div>
          <div className="dashboard-account"><span className="dashboard-account-avatar" aria-hidden="true">{profile.full_name.trim().slice(0, 1).toUpperCase()}</span><span className="dashboard-account-name"><strong>{profile.full_name}</strong><small>Writer</small></span></div>
          <DashboardNotificationBell notifications={notifications ?? []} />
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
                          <span>Employer: {employerProfiles.get(job.employer_id)?.full_name ?? "Accurate Writers employer"}</span>
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

          {key === "offers" && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">EMPLOYER OFFERS</p><h2>Offers waiting for your response</h2></div><span className="dashboard-count">{offers.filter((offer) => offer.status === "pending" && new Date(offer.expires_at) > new Date()).length} pending</span></div>
              {offers.length ? (
                <div className="dashboard-application-list">
                  {offers.map((offer) => (
                    <article className="dashboard-application" key={offer.id}>
                      <div>
                        <h3>{appliedJobs.get(offer.job_id)?.title ?? "Writing assignment"}</h3>
                        <p>From {employerProfiles.get(appliedJobs.get(offer.job_id)?.employer_id ?? "")?.full_name ?? "An employer"}</p>
                        <p>Offer: {formatBudget(offer.amount, offer.amount, offer.currency)}</p>
                        <p>{offer.instructions || "No additional instructions."}</p>
                        <p>Expires {formatDate(offer.expires_at)}</p>
                      </div>
                      <div className="dashboard-application-actions">
                        <span className={`dashboard-status status-${offer.status === "pending" && new Date(offer.expires_at) <= new Date() ? "rejected" : offer.status === "declined" || offer.status === "cancelled" ? "rejected" : offer.status === "accepted" ? "accepted" : "pending"}`}>{offer.status === "pending" && new Date(offer.expires_at) <= new Date() ? "expired" : offer.status.replaceAll("_", " ")}</span>
                        {offer.status === "pending" && new Date(offer.expires_at) > new Date() && <OfferResponseForm offerId={offer.id} />}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty"><h3>No offers yet</h3><p>When an employer selects you for a job, the offer and agreed details will appear here.</p><Link className="button" href="/dashboard/new">Browse opportunities</Link></div>
              )}
            </section>
          )}

          {(key === "assignments" || key === "in-progress" || key === "in-review" || key === "revision" || key === "completed" || key === "canceled") && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">ASSIGNMENT WORKSPACE</p><h2>{current.title}</h2></div><span className="dashboard-count">{visibleAssignments.length} assignments</span></div>
              {visibleAssignments.length ? (
                <div className="dashboard-list">
                  {visibleAssignments.map((assignment) => {
                    const job = assignmentJobs.get(assignment.job_id);
                    const assignmentSubmissions = submissions.filter((submission) => submission.assignment_id === assignment.id);
                    return (
                      <article className="dashboard-listing" key={assignment.id}>
                        <div className="dashboard-listing-heading"><div><span className="dashboard-category">{job?.category ?? "Assignment"}</span><h3>{job?.title ?? "Writing assignment"}</h3></div><StatusBadge status={assignment.status === "completed" ? "accepted" : assignment.status === "cancelled" ? "rejected" : assignment.status === "submitted_for_review" ? "shortlisted" : "pending"} /></div>
                        <p className="dashboard-description">Employer: {employerProfiles.get(assignment.employer_id)?.full_name ?? "Employer"}. Agreed payment: {formatBudget(assignment.agreed_amount, assignment.agreed_amount, assignment.currency)}. Deadline: {formatDate(assignment.deadline)}.</p>
                        <p className="dashboard-description">{assignment.instructions || job?.description}</p>
                        {assignmentSubmissions.length > 0 && (
                          <div className="dashboard-submission-history">
                            <h4>Submission history</h4>
                            {assignmentSubmissions.map((submission) => (
                              <article className="dashboard-submission-row" key={submission.id}>
                                <div><strong>Version {submission.version}: {submission.file_name}</strong><span>{formatDate(submission.created_at)} · {(submission.file_size / 1024 / 1024).toFixed(2)} MB · {submission.status.replaceAll("_", " ")}</span>{submission.comments && <span>{submission.comments}</span>}{submission.review_notes && <span className="dashboard-feedback error">Revision: {submission.review_notes}</span>}</div>
                                {submissionLinks.get(submission.id) && <a className="dashboard-table-link" href={submissionLinks.get(submission.id) ?? "#"} rel="noreferrer" target="_blank">Download</a>}
                              </article>
                            ))}
                          </div>
                        )}
                        {assignment.status === "in_progress" || assignment.status === "revision_requested" ? (
                          <AssignmentSubmissionForm assignmentId={assignment.id} writerId={userId} supabaseAnonKey={config.anonKey} supabaseUrl={config.url} />
                        ) : null}
                        <details className="dashboard-disclosure"><summary>Message employer</summary><DashboardMessageForm assignmentId={assignment.id} recipientId={assignment.employer_id} /></details>
                        {assignment.status === "completed" ? <AssignmentReviewForm assignmentId={assignment.id} revieweeId={assignment.employer_id} revieweeName="employer" /> : assignment.status !== "cancelled" ? <AssignmentDisputeForm assignmentId={assignment.id} /> : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="dashboard-empty"><h3>No assignments in this section</h3><p>Accepted offers become assignments and appear here once you accept them.</p>{key !== "completed" && <Link className="button" href="/dashboard/offers">Review job offers</Link>}</div>
              )}
            </section>
          )}

          {(key === "payments" || key === "pending-payment" || key === "paid") && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">EARNINGS</p><h2>{current.title}</h2></div><span className="dashboard-count">{payments.length} records</span></div>
              {payments.length ? <div className="dashboard-application-list">{payments.filter((payment) => key === "paid" ? payment.status === "paid" : key === "pending-payment" ? ["pending", "processing"].includes(payment.status) : true).map((payment) => <article className="dashboard-application" key={payment.id}><div><h3>{assignmentJobs.get(assignments.find((assignment) => assignment.id === payment.assignment_id)?.job_id ?? "")?.title ?? "Assignment payment"}</h3><p>Writer payout: {formatBudget(payment.amount, payment.amount, payment.currency)} · {payment.status.replaceAll("_", " ")}</p><p>Employer collection: {payment.collection_status.replaceAll("_", " ")}</p>{payment.collection_confirmed_at && <p>Employer paid {formatDate(payment.collection_confirmed_at)}{payment.provider_reference ? ` · receipt ${payment.provider_reference}` : ""}. Writer payout is separate.</p>}{payment.confirmed_at && <p>Writer payout confirmed {formatDate(payment.confirmed_at)}.</p>}</div></article>)}</div> : <div className="dashboard-empty"><h3>No payment records yet</h3><p>Payments are created when an employer approves your completed work. Collection and writer payout are tracked separately.</p></div>}
            </section>
          )}

          {key === "disputed" && <section className="dashboard-panel dashboard-section-panel"><div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">RESOLUTION</p><h2>Assignment disputes</h2></div><span className="dashboard-count">{disputes.length} total</span></div>{disputes.length ? <div className="dashboard-list">{disputes.map((dispute) => <article className="dashboard-listing" key={dispute.id}><h3>{assignmentJobs.get(assignments.find((assignment) => assignment.id === dispute.assignment_id)?.job_id ?? "")?.title ?? "Assignment"}</h3><p>{dispute.reason}</p><span className="dashboard-status status-pending">{dispute.status.replaceAll("_", " ")}</span><small>{formatDate(dispute.created_at)}</small></article>)}</div> : <div className="dashboard-empty"><h3>No disputes</h3><p>Any disputes you open about accepted work will appear here.</p></div>}</section>}

          {key === "rating" && <section className="dashboard-panel dashboard-section-panel"><div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">YOUR REPUTATION</p><h2>Assignment reviews</h2></div><span className="dashboard-count">{reviews.length} total</span></div>{reviews.length ? <div className="dashboard-list">{reviews.filter((review) => review.reviewee_id === userId).map((review) => <article className="dashboard-listing" key={review.id}><h3>{assignmentJobs.get(assignments.find((assignment) => assignment.id === review.assignment_id)?.job_id ?? "")?.title ?? "Completed assignment"}</h3><p>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p><p>{review.comment || "No written comment."}</p><small>{formatDate(review.created_at)}</small></article>)}</div> : <div className="dashboard-empty"><h3>No reviews yet</h3><p>Reviews from completed assignments will appear here.</p></div>}</section>}

          {key === "chat" && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">CONVERSATIONS</p><h2>Message employers</h2></div></div>
              {[...conversations.entries()].length ? <div className="dashboard-list">{[...conversations.entries()].map(([conversationKey, conversation]) => <article className="dashboard-listing" key={conversationKey}><h3>{conversation.name}</h3><div className="dashboard-message-thread">{messages.filter((message) => (conversation.assignmentId ? message.assignment_id === conversation.assignmentId : message.job_id === conversation.jobId) && (message.sender_id === conversation.recipientId || message.recipient_id === conversation.recipientId)).slice().reverse().map((message) => <p className={`dashboard-message-bubble${message.sender_id === userId ? " own" : ""}`} key={message.id}><strong>{message.sender_id === userId ? "You" : conversation.name}</strong><span>{message.body}</span><small>{formatDate(message.created_at)}</small></p>)}</div><DashboardMessageForm assignmentId={conversation.assignmentId} jobId={conversation.jobId} recipientId={conversation.recipientId} /></article>)}</div> : <div className="dashboard-empty"><h3>No conversations yet</h3><p>Conversations become available when you apply for a job or accept an assignment.</p></div>}
            </section>
          )}

          {key === "subscribe" && (
            <section className="dashboard-panel dashboard-section-panel subscription-plans-panel">
              <div className="subscription-plan-notice" role="note">
                <span className="subscription-plan-notice-icon" aria-hidden="true">i</span>
                <p><strong>You do not have an active subscription.</strong> Escrowed orders may carry a 15% platform fee. Choose a plan below to review your options.</p>
              </div>
              <div className="subscription-plan-content">
                <div className="subscription-plan-heading">
                  <p className="dashboard-eyebrow">MEMBERSHIP</p>
                  <h2>Pricing plans</h2>
                  <p>Choose the access period that works best for you.</p>
                </div>
                <div className="subscription-plan-grid">
                  {[
                    { name: "Weekly Plan", price: 150, period: "week", tone: "gold" },
                    { name: "2 Weeks Plan", price: 275, period: "2 weeks", tone: "blue" },
                    { name: "Monthly Plan", price: 500, period: "month", tone: "green" },
                  ].map((plan) => (
                    <article className={`subscription-plan-card subscription-plan-${plan.tone}`} key={plan.name}>
                      <h3>{plan.name}</h3>
                      <p className="subscription-plan-price"><strong>KES {plan.price.toLocaleString()}</strong><span> / {plan.period}</span></p>
                      <ul>
                        <li>Access to orders</li>
                        <li>24/7 support</li>
                        <li>SMS notifications</li>
                        <li>Email notifications</li>
                      </ul>
                      <button className="subscription-plan-button" disabled type="button">Subscribe</button>
                    </article>
                  ))}
                </div>
                <p className="subscription-plan-checkout-note">Subscription checkout is not connected yet, so these plans will not charge you.</p>
              </div>
            </section>
          )}

          {!isApplicationPage && !(key === "jobs" || key === "available" || key === "new" || key === "offers" || key === "assignments" || key === "in-progress" || key === "in-review" || key === "revision" || key === "completed" || key === "canceled" || key === "payments" || key === "pending-payment" || key === "paid" || key === "disputed" || key === "rating" || key === "chat" || key === "subscribe") && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-empty">
                <span className="dashboard-empty-mark" aria-hidden="true">i</span>
                <h2>{key === "profile" ? profile.full_name : current.title}</h2>
                <p>{current.description}</p>
                {key === "profile" ? <WriterProfileForm bio={profile.bio} skills={profile.skills} portfolioUrl={profile.portfolio_url} /> : <p className="dashboard-form-note">This module is ready in the workspace, but its account data is not connected yet.</p>}
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
