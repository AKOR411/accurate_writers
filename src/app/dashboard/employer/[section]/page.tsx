import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreateJobForm } from "@/app/dashboard/dashboard-forms";
import DashboardSidebar from "@/app/dashboard/dashboard-sidebar";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createReadOnlyClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/supabase/database.types";

export const instant = false;

const modules = {
  orders: { title: "All Orders", description: "Review and manage every writing order posted from your account." },
  "post-order": { title: "Post an Order", description: "Create a clear brief and publish a new writing opportunity." },
  "all-orders": { title: "All Orders", description: "Review and manage every writing order posted from your account." },
  "draft-orders": { title: "Draft Orders", description: "Draft order saving is not connected yet. Orders are submitted directly for administrator review." },
  "request-bid": { title: "Request / Bid", description: "Review proposals writers have submitted for your orders." },
  tasks: { title: "Tasks", description: "Task tracking will appear here as order management is connected." },
  public: { title: "Public Orders", description: "Approved public opportunities currently visible to writers." },
  escrowed: { title: "Escrowed", description: "Escrow tracking is not connected to this workspace yet." },
  "in-progress": { title: "In Progress", description: "Orders with accepted writer applications." },
  unconfirmed: { title: "Unconfirmed", description: "Orders awaiting confirmation will appear here when order confirmation is connected." },
  submitted: { title: "Submitted", description: "Submitted work will appear here when delivery tracking is connected." },
  "in-revision": { title: "In Revision", description: "Work returned for revision will appear here when revision tracking is connected." },
  completed: { title: "Completed", description: "Completed orders and delivery records will appear here." },
  disputed: { title: "Disputed", description: "Dispute updates will appear here when order resolution is connected." },
  unpaid: { title: "Unpaid / Incomplete", description: "Unpaid and incomplete order tracking is not connected yet." },
  paid: { title: "Paid", description: "Payment records will appear here when payments are connected." },
  canceled: { title: "Canceled", description: "Canceled orders will appear here when cancellation tracking is connected." },
  test: { title: "Test Orders", description: "Test orders will appear here when this order type is available." },
  request: { title: "Requests", description: "Custom order requests will appear here when request workflows are connected." },
  "overdue-public": { title: "Overdue Public", description: "Overdue public orders will appear here when deadline tracking is connected." },
  "overdue-private": { title: "Overdue Private", description: "Overdue private orders will appear here when deadline tracking is connected." },
  "partially-paid": { title: "Partially Paid", description: "Partial payment records will appear here when payments are connected." },
  "old-orders": { title: "Old Orders", description: "Archived orders will appear here when order archiving is connected." },
  "my-writers": { title: "My Writers", description: "Writers you have worked with will appear here." },
  "public-writers": { title: "Public Writers", description: "Browse public writer profiles when the writer directory is connected." },
  "top-writers": { title: "Top Writers", description: "Top-rated writers will appear here when ratings are available." },
  "manage-reviews": { title: "Manage Reviews", description: "Writer reviews will appear here when review tools are connected." },
  chat: { title: "Chat", description: "Your conversations with writers will appear here when messaging is connected." },
  "my-account": { title: "My Account", description: "Manage your employer account details and preferences." },
  profile: { title: "Profile", description: "Employer profile editing is not connected yet." },
  settings: { title: "Settings", description: "Account preferences will appear here when settings are connected." },
  "transaction-history": { title: "Transaction History", description: "Your transaction records will appear here when payments are connected." },
  subscriptions: { title: "Subscriptions", description: "View and manage your employer subscription when plans are connected." },
  guidelines: { title: "Guidelines / FAQs", description: "Find guidance for posting orders and working with writers." },
  "untrusted-writers": { title: "Untrusted Writers", description: "Safety notices will appear here when the writer reporting directory is connected." },
  news: { title: "News", description: "The latest Accurate Writers announcements will appear here." },
  rules: { title: "Rules & Regulations", description: "Review the standards that keep the marketplace fair and reliable." },
} as const;

const orderListSections = ["orders", "all-orders", "public", "in-progress"] as const;

function StatusBadge({ status }: { status: JobStatus }) {
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

  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, title, category, budget_min, budget_max, currency, deadline, status, created_at")
    .eq("employer_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (jobsError) throw new Error(`Could not load your orders: ${jobsError.message}`);

  const orders = jobs ?? [];
  const ids = orders.map((job) => job.id);
  const applicationsResult = ids.length
    ? await supabase.from("applications").select("id, job_id, status").in("job_id", ids)
    : { data: [], error: null };
  if (applicationsResult.error) throw new Error(`Could not load order applications: ${applicationsResult.error.message}`);
  const applications = applicationsResult.data ?? [];
  const inProgressIds = new Set(
    applications.filter((application) => application.status === "accepted").map((application) => application.job_id),
  );
  const isOrderList = orderListSections.some((listSection) => listSection === key);
  const filteredOrders = key === "public"
    ? orders.filter((job) => job.status === "approved")
    : key === "in-progress"
      ? orders.filter((job) => inProgressIds.has(job.id))
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
                    <th scope="col">Applications</th><th scope="col">Deadline</th><th scope="col">Status</th>
                  </tr></thead>
                  <tbody>
                    {searchedOrders.map((job) => (
                      <tr key={job.id}>
                        <td className="dashboard-table-title"><span>{job.title}</span><small>{job.id.slice(0, 8)}</small></td>
                        <td>{job.category}</td>
                        <td>{job.currency} {job.budget_min.toLocaleString()}–{job.budget_max.toLocaleString()}</td>
                        <td>{applicationCountByJob.get(job.id) ?? 0}</td>
                        <td>{job.deadline ? new Date(job.deadline).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" }) : "Not specified"}</td>
                        <td><StatusBadge status={job.status} /></td>
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

          {key === "draft-orders" && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-empty"><span className="dashboard-empty-mark" aria-hidden="true">i</span><h2>Draft saving is not connected yet</h2><p>{current.description}</p><Link className="button" href="/dashboard/employer/post-order">Create an order</Link></div>
            </section>
          )}

          {key === "request-bid" && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-panel-heading"><div><p className="dashboard-eyebrow">WRITER PROPOSALS</p><h2>Applications received</h2></div><span className="dashboard-count">{applications.length} total</span></div>
              <p className="dashboard-intro">Review proposals from writers on your orders from the main Applications section.</p>
              <Link className="button" href="/dashboard#applications">View applications</Link>
            </section>
          )}

          {!isOrderList && key !== "post-order" && key !== "draft-orders" && key !== "request-bid" && (
            <section className="dashboard-panel dashboard-section-panel">
              <div className="dashboard-empty"><span className="dashboard-empty-mark" aria-hidden="true">i</span><h2>{current.title}</h2><p>{current.description}</p><p className="dashboard-form-note">This module is ready in your workspace, but its order or account data is not connected yet.</p></div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
