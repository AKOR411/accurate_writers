import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AwardApplicationForm, AssignmentDisputeForm, AssignmentReviewForm, CancelAssignmentForm, CreateJobForm, DashboardMessageForm, DarajaPaymentForm, EditJobForm, PublishDraftForm, ReviewApplicationForm, ReviewSubmissionForm } from "@/app/dashboard/dashboard-forms";
import DashboardSidebar from "@/app/dashboard/dashboard-sidebar";
import DashboardNotificationBell from "@/app/dashboard/dashboard-notification-bell";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createReadOnlyClient } from "@/lib/supabase/server";
import type { ApplicationStatus, JobStatus } from "@/lib/supabase/database.types";

export const instant = false;

const modules = {
  orders: { title: "All Orders", description: "Review and manage every writing order posted from your account." },
  "post-order": { title: "Post an Order", description: "Create a clear brief and publish a new writing opportunity." },
  "all-orders": { title: "All Orders", description: "Review and manage every writing order posted from your account." },
  "draft-orders": { title: "Draft Orders", description: "Edit and publish drafts when they are ready for administrator review." },
  "request-bid": { title: "Request / Bid", description: "Review proposals writers have submitted for your orders." },
  tasks: { title: "Tasks", description: "Task tracking will appear here as order management is connected." },
  public: { title: "Public Orders", description: "Approved public opportunities currently visible to writers." },
  escrowed: { title: "Escrowed", description: "Escrow tracking is not connected to this workspace yet." },
  "in-progress": { title: "In Progress", description: "Manage accepted assignments, submissions, and revision requests." },
  unconfirmed: { title: "Unconfirmed", description: "Orders awaiting confirmation will appear here when order confirmation is connected." },
  submitted: { title: "Submitted", description: "Submitted work will appear here when delivery tracking is connected." },
  "in-revision": { title: "In Revision", description: "Work returned for revision will appear here when revision tracking is connected." },
  completed: { title: "Completed", description: "Completed orders and delivery records will appear here." },
  disputed: { title: "Disputed", description: "Dispute updates will appear here when order resolution is connected." },
  unpaid: { title: "Unpaid / Incomplete", description: "Assignment invoices awaiting M-PESA collection appear here." },
  paid: { title: "Paid", description: "Confirmed employer collections appear here; writer payouts are tracked separately." },
  canceled: { title: "Canceled", description: "Canceled orders will appear here when cancellation tracking is connected." },
  test: { title: "Test Orders", description: "Test orders will appear here when this order type is available." },
  request: { title: "Requests", description: "Custom order requests will appear here when request workflows are connected." },
  "overdue-public": { title: "Overdue Public", description: "Overdue public orders will appear here when deadline tracking is connected." },
  "overdue-private": { title: "Overdue Private", description: "Overdue private orders will appear here when deadline tracking is connected." },
  "partially-paid": { title: "Partially Paid", description: "Partial payment records will appear here when payments are connected." },
  "old-orders": { title: "Old Orders", description: "Archived orders will appear here when order archiving is connected." },
  "my-writers": { title: "My Writers", description: "Browse writers and manage your private and public writer lists." },
  "private-writers": { title: "Private Writers", description: "Writers saved to your private list will appear here." },
  "public-writers": { title: "Public Writers", description: "Browse public writer profiles when the writer directory is connected." },
  "favourite-public": { title: "Favourite (Public)", description: "Your favourite public writers will appear here." },
  "suspended-writers": { title: "Suspended Writers", description: "Writers you have suspended will appear here." },
  "unapproved-writers": { title: "Unapproved Writers", description: "Writer profiles waiting for approval will appear here." },
  "invite-writer": { title: "Invite Writer", description: "Writer invitations will be available when employer-to-writer invitations are connected." },
  "manage-reviews": { title: "Manage Reviews", description: "Writer reviews will appear here when review tools are connected." },
  chat: { title: "Chat", description: "Your conversations with writers will appear here when messaging is connected." },
  "my-account": { title: "All Accounts", description: "Review employer accounts associated with your workspace." },
  "all-accounts": { title: "All Accounts", description: "Review employer accounts associated with your workspace." },
  "add-account": { title: "Add Account", description: "Add another employer account when account management is connected." },
  profile: { title: "Profile", description: "Employer profile editing is not connected yet." },
  settings: { title: "Settings", description: "Account preferences will appear here when settings are connected." },
  "transaction-history": { title: "Transaction History", description: "Review wallet activity, SMS usage, and plagiarism checker activity." },
  "wallet-statement": { title: "Wallet Statement", description: "Your wallet transactions will appear here when payments are connected." },
  sms: { title: "SMS", description: "SMS usage and message history will appear here when messaging is connected." },
  "plag-checker": { title: "Plag Checker", description: "Plagiarism checker usage will appear here when the service is connected." },
  subscriptions: { title: "Subscriptions", description: "View and manage your employer subscription." },
  subscribe: { title: "Subscribe", description: "Explore employer subscription plans when billing is connected." },
  "active-subscriptions": { title: "Active Subscriptions", description: "Your current employer plans will appear here when billing is connected." },
  "expired-subscriptions": { title: "Expired Subscriptions", description: "Your expired employer plans will appear here when billing is connected." },
  guidelines: { title: "Guidelines / FAQs", description: "Find guidance for posting orders and working with writers." },
  "untrusted-writers": { title: "Untrusted Writers", description: "Safety notices will appear here when the writer reporting directory is connected." },
  news: { title: "News", description: "The latest Accurate Writers announcements will appear here." },
  rules: { title: "Rules & Regulations", description: "Review the standards that keep the marketplace fair and reliable." },
} as const;

const orderListSections = ["orders", "all-orders", "draft-orders", "public"] as const;

function StatusBadge({ status }: { status: JobStatus | ApplicationStatus }) {
  return <span className={`dashboard-status status-${status}`}>{status.replaceAll("_", " ")}</span>;
}

export default async function EmployerSectionPage({
  params,
  searchParams,
}: PageProps<"/dashboard/employer/[section]">) {
  const { section } = await params;
  const query = await searchParams;
  if (!Object.hasOwn(modules, section)) notFound();
  const key = section as keyof typeof modules;
  const current = modules[key];
  const config = getSupabaseConfig();

  if (!config.configured) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-card">
          <p className="section-kicker">BACKEND SETUP</p>
          <h1>Connect your Supabase project</h1>
          <p>{config.message}</p>
          <Link className="button" href="/">Back to Accurate Writers</Link>
        </section>
      </main>
    );
  }

  const supabase = await createReadOnlyClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) throw new Error(`Could not verify the Supabase session: ${claimsError.message}`);
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/register?mode=login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .single();
  if (profileError) throw new Error(`Could not load your profile: ${profileError.message}`);
  if (profile.role !== "employer") redirect("/dashboard");
  const { data: notifications, error: notificationsError } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (notificationsError) throw new Error(`Could not load notifications: ${notificationsError.message}`);

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, title, description, category, budget_min, budget_max, currency, word_count, deadline, status, is_draft, filled_at, created_at")
    .eq("employer_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (jobsError) throw new Error(`Could not load your orders: ${jobsError.message}`);

  const orders = jobs ?? [];
  const ids = orders.map((job) => job.id);
  const applicationsResult = ids.length
    ? await supabase.from("applications").select("id, job_id, writer_id, status, proposed_budget, cover_letter, experience_summary, created_at").in("job_id", ids)
    : { data: [], error: null };
  if (applicationsResult.error) throw new Error(`Could not load order applications: ${applicationsResult.error.message}`);
  const applications = applicationsResult.data ?? [];
  const writerIds = [...new Set(applications.map((application) => application.writer_id))];
  const writersResult = writerIds.length
    ? await supabase.from("profiles").select("id, full_name, bio, skills, portfolio_url").in("id", writerIds)
    : { data: [], error: null };
  if (writersResult.error) throw new Error(`Could not load applicant profiles: ${writersResult.error.message}`);
  const writerProfiles = new Map((writersResult.data ?? []).map((writer) => [writer.id, writer]));
  const assignmentsResult = await supabase
    .from("assignments")
    .select("id, job_id, writer_id, agreed_amount, currency, instructions, deadline, status, accepted_at")
    .eq("employer_id", userId)
    .order("accepted_at", { ascending: false })
    .limit(100);
  if (assignmentsResult.error) throw new Error(`Could not load your assignments: ${assignmentsResult.error.message}`);
  const assignments = assignmentsResult.data ?? [];
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const [disputesResult, reviewsResult] = assignmentIds.length ? await Promise.all([
    supabase.from("disputes").select("id, assignment_id, opened_by, reason, status, created_at").in("assignment_id", assignmentIds).order("created_at", { ascending: false }),
    supabase.from("reviews").select("id, assignment_id, reviewer_id, reviewee_id, rating, comment, created_at").in("assignment_id", assignmentIds).order("created_at", { ascending: false }),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (disputesResult.error) throw new Error(`Could not load assignment disputes: ${disputesResult.error.message}`);
  if (reviewsResult.error) throw new Error(`Could not load assignment reviews: ${reviewsResult.error.message}`);
  const disputes = disputesResult.data ?? [];
  const reviews = reviewsResult.data ?? [];
  const submissionsResult = assignmentIds.length
    ? await supabase.from("work_submissions").select("id, assignment_id, writer_id, version, storage_path, file_name, file_size, comments, status, review_notes, created_at").in("assignment_id", assignmentIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (submissionsResult.error) throw new Error(`Could not load work submissions: ${submissionsResult.error.message}`);
  const submissions = submissionsResult.data ?? [];
  const submissionLinks = new Map(await Promise.all(submissions.map(async (submission) => {
    const { data, error } = await supabase.storage.from("work-submissions").createSignedUrl(submission.storage_path, 60);
    return [submission.id, error ? null : data.signedUrl] as const;
  })));
  const assignmentJobsResult = ids.length
    ? await supabase.from("jobs").select("id, title, description, category, word_count").in("id", ids)
    : { data: [], error: null };
  if (assignmentJobsResult.error) throw new Error(`Could not load assignment job details: ${assignmentJobsResult.error.message}`);
  const jobById = new Map((assignmentJobsResult.data ?? []).map((job) => [job.id, job]));
  const orderById = new Map(orders.map((job) => [job.id, job]));
  const paymentsResult = await supabase
    .from("payments")
    .select("id, assignment_id, amount, currency, status, collection_status, collection_confirmed_at, provider_reference, confirmed_at, created_at")
    .eq("employer_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (paymentsResult.error) throw new Error(`Could not load your transactions: ${paymentsResult.error.message}`);
  const payments = paymentsResult.data ?? [];
  const relevantApplications = key === "request-bid"
    ? applications.filter((application) => application.status !== "withdrawn")
    : applications;
  const visibleAssignments = assignments.filter((assignment) => {
    if (key === "in-progress") return ["in_progress", "revision_requested"].includes(assignment.status);
    if (key === "submitted") return assignment.status === "submitted_for_review";
    if (key === "in-revision") return assignment.status === "revision_requested";
    if (key === "completed") return assignment.status === "completed";
    if (key === "canceled") return assignment.status === "cancelled";
    return false;
  });
  const messagesResult = await supabase
    .from("messages")
    .select("id, assignment_id, job_id, sender_id, recipient_id, body, read_at, created_at")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (messagesResult.error) throw new Error(`Could not load your messages: ${messagesResult.error.message}`);
  const messages = messagesResult.data ?? [];
  const isOrderList = orderListSections.some((listSection) => listSection === key);
  const filteredOrders = key === "public"
    ? orders.filter((job) => job.status === "approved")
    : key === "draft-orders"
      ? orders.filter((job) => job.is_draft)
      : orders;
  const search = typeof query.q === "string" ? query.q.trim().toLocaleLowerCase() : "";
  const searchedOrders = filteredOrders.filter((job) =>
    !search || `${job.title} ${job.category} ${job.id}`.toLocaleLowerCase().includes(search),
  );
  const pageSize = [10, 20, 50, 100].includes(Number(query.pageSize)) ? Number(query.pageSize) : 20;
  const applicationCountByJob = new Map<string, number>();
  for (const application of applications) {
    applicationCountByJob.set(application.job_id, (applicationCountByJob.get(application.job_id) ?? 0) + 1);
  }

  return (
    <div className="dashboard-app-shell role-employer">
      <DashboardSidebar role="employer" />
      <main className="dashboard-main employer-module-main">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-crumb">
            <span>Workspace</span><span aria-hidden="true">/</span><strong>{current.title}</strong>
          </div>
          <div className="dashboard-account">
            <span className="dashboard-account-avatar" aria-hidden="true">{profile.full_name.trim().slice(0, 1).toUpperCase()}</span>
            <span className="dashboard-account-name"><strong>{profile.full_name}</strong><small>Employer</small></span>
          </div>
          <DashboardNotificationBell notifications={notifications ?? []} />
        </header>

        <section className="dashboard-content">
          <div className="employer-module-heading">
            <div>
              <div className="dashboard-topbar-crumb"><Link href="/dashboard">Home</Link><span aria-hidden="true">/</span><strong>{current.title}</strong></div>
              <h1>{current.title}</h1>
            </div>
            <Link className="button" href="/dashboard/employer/post-order">Post an Order</Link>
          </div>

          {key === "post-order" && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-panel-heading">
                <div><p className="dashboard-eyebrow">CREATE AN OPPORTUNITY</p><h2>Order details</h2></div>
              </div>
              <CreateJobForm />
            </section>
          )}

          {isOrderList && (
            <section className="dashboard-panel employer-orders-panel">
              <div className="employer-orders-toolbar">
                <form className="employer-orders-filters" method="get">
                  <label className="visually-hidden" htmlFor="order-search">Search orders</label>
                  <input id="order-search" name="q" defaultValue={search} placeholder="Search by order title, category, or ID..." />
                  <label className="visually-hidden" htmlFor="order-page-size">Rows per page</label>
                  <select id="order-page-size" defaultValue={String(pageSize)} name="pageSize">
                    <option value="10">10 per page</option><option value="20">20 per page</option>
                    <option value="50">50 per page</option><option value="100">100 per page</option>
                  </select>
                  <button className="dashboard-small-button" type="submit">Search</button>
                </form>
                <button className="dashboard-small-button" disabled type="button">Bulk Actions</button>
              </div>
              <div className="dashboard-table-scroll">
                <table className="dashboard-table employer-orders-table">
                  <thead><tr>
                    <th scope="col">Order</th><th scope="col">Category</th><th scope="col">Budget</th>
                    <th scope="col">Applications</th><th scope="col">Deadline</th><th scope="col">Status</th><th scope="col">Actions</th>
                  </tr></thead>
                  <tbody>
                    {searchedOrders.map((job) => (
                      <tr key={job.id}>
                        <td className="dashboard-table-title"><span>{job.title}</span><small>{job.id.slice(0, 8)}</small></td>
                        <td>{job.category}</td>
                        <td>{job.currency} {job.budget_min.toLocaleString()}–{job.budget_max.toLocaleString()}</td>
                        <td>{applicationCountByJob.get(job.id) ?? 0}</td>
                        <td>{job.deadline ? new Date(job.deadline).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" }) : "Not specified"}</td>
                        <td>{job.is_draft ? <span className="dashboard-status status-pending">Draft</span> : <StatusBadge status={job.status} />}</td>
                        <td><EditJobForm job={job} />{job.is_draft && <PublishDraftForm jobId={job.id} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {searchedOrders.length === 0 && (
                <div className="employer-orders-empty">
                  <h2>{search ? "No matching orders" : "No orders to show"}</h2>
                  <p>{search ? "Try a different search term." : key === "public" ? "Approved public orders will appear here." : key === "in-progress" ? "Orders with an accepted writer application will appear here." : "Orders you create will appear here with their status and application activity."}</p>
                  {!search && <Link className="button" href="/dashboard/employer/post-order">Create your first order</Link>}
                </div>
              )}
              <div className="employer-orders-footer">
                <span>Showing {searchedOrders.length ? 1 : 0}–{Math.min(pageSize, searchedOrders.length)} of {searchedOrders.length} orders</span>
                <button className="dashboard-small-button" disabled type="button">With selected</button>
              </div>
            </section>
          )}

          {key === "request-bid" && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">WRITER PROPOSALS</p><h2>Applications received</h2></div><span className="dashboard-count">{relevantApplications.length} total</span></div>
              {relevantApplications.length ? <div className="dashboard-list">{relevantApplications.map((application) => {
                const job = orderById.get(application.job_id);
                const writer = writerProfiles.get(application.writer_id);
                return <article className="dashboard-listing" key={application.id}>
                  <div className="dashboard-listing-heading"><div><span className="dashboard-category">{job?.category ?? "Order"} · {job?.title ?? "Writing order"}</span><h3>{writer?.full_name ?? "Writer"}</h3></div><StatusBadge status={application.status} /></div>
                  <p className="dashboard-description">Proposed budget: {application.proposed_budget === null ? "Not specified" : `${job?.currency ?? "KES"} ${application.proposed_budget.toLocaleString()}`}. Applied {new Date(application.created_at).toLocaleString()}.</p>
                  {application.experience_summary && <p className="dashboard-description"><strong>Relevant experience:</strong> {application.experience_summary}</p>}
                  <p className="dashboard-description">{application.cover_letter}</p>
                  {writer?.bio && <p className="dashboard-description"><strong>Profile:</strong> {writer.bio}</p>}
                  {writer?.skills?.length ? <p className="dashboard-description"><strong>Skills:</strong> {writer.skills.join(", ")}</p> : null}
                  {writer?.portfolio_url && <a className="dashboard-table-link" href={writer.portfolio_url} target="_blank" rel="noreferrer">View portfolio</a>}
                  {application.status === "pending" || application.status === "shortlisted" ? <div className="dashboard-form-actions"><ReviewApplicationForm applicationId={application.id} status={application.status} />{application.status === "shortlisted" && <AwardApplicationForm applicationId={application.id} currency={job?.currency ?? "KES"} suggestedAmount={application.proposed_budget ?? job?.budget_min ?? null} />}</div> : null}
                  <details className="dashboard-disclosure"><summary>Message writer</summary><DashboardMessageForm jobId={application.job_id} recipientId={application.writer_id} /></details>
                </article>;
              })}</div> : <div className="dashboard-empty"><h3>No applications yet</h3><p>Writer proposals will appear here when someone applies to one of your orders.</p></div>}
            </section>
          )}

          {["in-progress", "submitted", "in-revision", "completed", "canceled"].includes(key) && <section className="dashboard-panel dashboard-section-panel">
            <div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">ASSIGNMENT MANAGEMENT</p><h2>{current.title}</h2></div><span className="dashboard-count">{visibleAssignments.length} assignments</span></div>
            {visibleAssignments.length ? <div className="dashboard-list">{visibleAssignments.map((assignment) => {
              const job = jobById.get(assignment.job_id);
              const writer = writerProfiles.get(assignment.writer_id);
              const assignmentSubmissions = submissions.filter((submission) => submission.assignment_id === assignment.id);
              return <article className="dashboard-listing" key={assignment.id}>
                <div className="dashboard-listing-heading"><div><span className="dashboard-category">{job?.category ?? "Assignment"}</span><h3>{job?.title ?? "Writing assignment"}</h3></div><span className="dashboard-budget">{assignment.currency} {assignment.agreed_amount.toLocaleString()}</span></div>
                <p className="dashboard-description">Writer: {writer?.full_name ?? "Writer"} · Deadline: {assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : "Flexible"} · {assignment.status.replaceAll("_", " ")}</p>
                <p className="dashboard-description">{assignment.instructions || job?.description}</p>
                {assignmentSubmissions.map((submission) => <article className="dashboard-submission-row" key={submission.id}><div><strong>Version {submission.version}: {submission.file_name}</strong><span>{new Date(submission.created_at).toLocaleString()} · {(submission.file_size / 1024 / 1024).toFixed(2)} MB · {submission.status.replaceAll("_", " ")}</span>{submission.comments && <span>{submission.comments}</span>}{submission.review_notes && <span>{submission.review_notes}</span>}</div>{submissionLinks.get(submission.id) && <a className="dashboard-table-link" href={submissionLinks.get(submission.id) ?? "#"} rel="noreferrer" target="_blank">Download securely</a>}</article>)}
                {assignment.status === "submitted_for_review" && <ReviewSubmissionForm assignmentId={assignment.id} />}
                {["in_progress", "revision_requested"].includes(assignment.status) && <CancelAssignmentForm assignmentId={assignment.id} />}
                <details className="dashboard-disclosure"><summary>Message writer</summary><DashboardMessageForm assignmentId={assignment.id} recipientId={assignment.writer_id} /></details>
                {assignment.status === "completed" ? <AssignmentReviewForm assignmentId={assignment.id} revieweeId={assignment.writer_id} revieweeName="writer" /> : <AssignmentDisputeForm assignmentId={assignment.id} />}
              </article>;
            })}</div> : <div className="dashboard-empty"><h3>No assignments to show</h3><p>Accepted offers and submitted work will appear in this module.</p></div>}
          </section>}

          {key === "disputed" && <section className="dashboard-panel dashboard-section-panel"><div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">RESOLUTION</p><h2>Assignment disputes</h2></div><span className="dashboard-count">{disputes.length} total</span></div>{disputes.length ? <div className="dashboard-list">{disputes.map((dispute) => <article className="dashboard-listing" key={dispute.id}><h3>{jobById.get(assignments.find((assignment) => assignment.id === dispute.assignment_id)?.job_id ?? "")?.title ?? "Assignment"}</h3><p>{dispute.reason}</p><span className="dashboard-status status-pending">{dispute.status.replaceAll("_", " ")}</span><small>{new Date(dispute.created_at).toLocaleString()}</small></article>)}</div> : <div className="dashboard-empty"><h3>No open disputes</h3><p>Disputes submitted by either participant will be listed here for administrator review.</p></div>}</section>}

          {key === "manage-reviews" && <section className="dashboard-panel dashboard-section-panel"><div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">WRITER FEEDBACK</p><h2>Reviews</h2></div><span className="dashboard-count">{reviews.filter((review) => review.reviewee_id === userId).length} received</span></div>{reviews.filter((review) => review.reviewee_id === userId).length ? <div className="dashboard-list">{reviews.filter((review) => review.reviewee_id === userId).map((review) => <article className="dashboard-listing" key={review.id}><h3>{jobById.get(assignments.find((assignment) => assignment.id === review.assignment_id)?.job_id ?? "")?.title ?? "Completed assignment"}</h3><p>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p><p>{review.comment || "No written comment."}</p><small>{new Date(review.created_at).toLocaleString()}</small></article>)}</div> : <div className="dashboard-empty"><h3>No writer reviews yet</h3><p>Feedback from writers on completed assignments will appear here.</p></div>}</section>}

          {["paid", "unpaid", "partially-paid", "transaction-history", "wallet-statement"].includes(key) && <section className="dashboard-panel dashboard-section-panel">
            <div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">PAYMENT RECORDS</p><h2>{current.title}</h2></div><span className="dashboard-count">{payments.length} records</span></div>
            {payments.length ? <div className="dashboard-application-list">{payments.filter((payment) => key === "paid" ? payment.collection_status === "paid" : key === "unpaid" ? ["pending", "processing", "failed"].includes(payment.collection_status) : true).map((payment) => <article className="dashboard-application" key={payment.id}><div><h3>{jobById.get(assignments.find((assignment) => assignment.id === payment.assignment_id)?.job_id ?? "")?.title ?? "Assignment payment"}</h3><p>{payment.currency} {payment.amount.toLocaleString()} · employer collection {payment.collection_status.replaceAll("_", " ")}</p><p>Writer payout status: {payment.status.replaceAll("_", " ")}</p><p>Recorded {new Date(payment.created_at).toLocaleString()}</p>{payment.collection_confirmed_at && <p>M-PESA receipt {payment.provider_reference ?? "confirmed"} · {new Date(payment.collection_confirmed_at).toLocaleString()}</p>}{payment.collection_status === "pending" || payment.collection_status === "failed" ? payment.currency === "KES" ? <DarajaPaymentForm paymentId={payment.id} /> : <p className="dashboard-form-note">Daraja checkout is available for KES amounts only.</p> : payment.collection_status === "processing" ? <p className="dashboard-form-note">Waiting for M-PESA confirmation. Revisit this page to refresh the status.</p> : <p className="dashboard-form-note">Collection is confirmed. Writer payout is tracked separately.</p>}</div></article>)}</div> : <div className="dashboard-empty"><h3>No payment records yet</h3><p>Payments appear after an employer approves work. Records remain pending until a verified payment provider confirms settlement.</p></div>}
          </section>}

          {key === "chat" && <section className="dashboard-panel dashboard-section-panel">
            <div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">CONVERSATIONS</p><h2>Messages with writers</h2></div></div>
            {messages.length ? <div className="dashboard-list">{[...new Set(messages.map((message) => message.assignment_id ?? message.job_id ?? ""))].filter(Boolean).map((threadId) => {
              const thread = messages.filter((message) => (message.assignment_id ?? message.job_id) === threadId).slice().reverse();
              const participantId = thread[0]?.sender_id === userId ? thread[0]?.recipient_id : thread[0]?.sender_id;
              const assignment = assignments.find((item) => item.id === threadId);
              const jobId = thread[0]?.job_id ?? assignment?.job_id;
              return <article className="dashboard-listing" key={threadId}><h3>{writerProfiles.get(participantId ?? "")?.full_name ?? "Writer"}</h3><div className="dashboard-message-thread">{thread.map((message) => <p className={`dashboard-message-bubble${message.sender_id === userId ? " own" : ""}`} key={message.id}><strong>{message.sender_id === userId ? "You" : writerProfiles.get(message.sender_id)?.full_name ?? "Writer"}</strong><span>{message.body}</span><small>{new Date(message.created_at).toLocaleString()}</small></p>)}</div><DashboardMessageForm assignmentId={assignment?.id} jobId={assignment ? undefined : jobId} recipientId={participantId ?? ""} /></article>;
            })}</div> : <div className="dashboard-empty"><h3>No conversations yet</h3><p>Message a writer from an application or active assignment to start a conversation.</p></div>}
          </section>}

          {!isOrderList && key !== "post-order" && key !== "draft-orders" && key !== "request-bid" && !["in-progress", "submitted", "in-revision", "completed", "canceled", "disputed", "manage-reviews", "paid", "unpaid", "partially-paid", "transaction-history", "wallet-statement", "chat"].includes(key) && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-empty"><span className="dashboard-empty-mark" aria-hidden="true">i</span><h2>{current.title}</h2><p>{current.description}</p><p className="dashboard-form-note">This module is ready in your workspace, but its order or account data is not connected yet.</p></div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
