"use client";

import { useActionState } from "react";
import {
  applyToJob,
  awardApplication,
  closeJob,
  createJob,
  reviewApplication,
  withdrawApplication,
  respondToOffer,
  reviewWorkSubmission,
  sendDashboardMessage,
  updateWriterProfile,
  publishDraft,
  updateJob,
  openAssignmentDispute,
  submitAssignmentReview,
  cancelAssignment,
  initiateDarajaPayment,
  type DashboardActionState,
} from "@/app/actions/dashboard";
import type { ApplicationStatus } from "@/lib/supabase/database.types";

function Feedback({ state }: { state: DashboardActionState }) {
  if (!state.error && !state.success) {
    return null;
  }

  return (
    <p
      className={state.error ? "dashboard-feedback error" : "dashboard-feedback success"}
      role={state.error ? "alert" : "status"}
    >
      {state.error ?? state.success}
    </p>
  );
}

export function CreateJobForm() {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(
    createJob,
    {},
  );

  return (
    <details className="dashboard-disclosure" open>
      <summary>Post a new writing job <span aria-hidden="true">＋</span></summary>
      <form action={formAction} className="dashboard-form">
        <div className="dashboard-form-grid">
          <label>
            Job title
            <input name="title" maxLength={140} minLength={5} required />
          </label>
          <label>
            Category
            <input name="category" maxLength={60} minLength={2} placeholder="e.g. Blog writing" required />
          </label>
          <label>
            Minimum budget
            <input name="budget_min" min="0.01" step="0.01" type="number" required />
          </label>
          <label>
            Maximum budget
            <input name="budget_max" min="0.01" step="0.01" type="number" required />
          </label>
          <label>
            Currency
            <select defaultValue="KES" name="currency">
              <option value="KES">KES · Kenyan shilling</option>
              <option value="USD">USD · US dollar</option>
              <option value="GBP">GBP · Pound sterling</option>
              <option value="EUR">EUR · Euro</option>
            </select>
          </label>
          <label>
            Word count <span className="dashboard-optional">(optional)</span>
            <input min="1" name="word_count" step="1" type="number" />
          </label>
          <label>
            Deadline <span className="dashboard-optional">(optional)</span>
            <input name="deadline" type="date" />
          </label>
        </div>
        <label>
          Project brief
          <textarea
            maxLength={10000}
            minLength={30}
            name="description"
            placeholder="Describe the work, requirements, and what a successful delivery looks like."
            required
            rows={5}
          />
        </label>
        <Feedback state={state} />
        <div className="dashboard-form-actions">
          <button className="button dashboard-form-submit" disabled={isPending} name="intent" type="submit" value="publish">
            {isPending ? "Submitting..." : "Submit job for review"}
          </button>
          <button className="dashboard-secondary-button" disabled={isPending} name="intent" type="submit" value="draft">
            Save draft
          </button>
        </div>
        <p className="dashboard-form-note">
          New listings are reviewed before they become visible to writers.
        </p>
      </form>
    </details>
  );
}

export function ApplyToJobForm({
  jobId,
  currency,
}: {
  jobId: string;
  currency: string;
}) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(
    applyToJob,
    {},
  );

  return (
    <details className="dashboard-disclosure dashboard-apply">
      <summary>Apply for this job <span aria-hidden="true">＋</span></summary>
      <form action={formAction} className="dashboard-form">
        <input name="job_id" type="hidden" value={jobId} />
        <label>
          Cover letter
          <textarea
            maxLength={5000}
            minLength={30}
            name="cover_letter"
            placeholder="Introduce yourself and explain why you’re a good fit."
            required
            rows={4}
          />
        </label>
        <label>
          Relevant experience <span className="dashboard-optional">(optional)</span>
          <textarea maxLength={4000} name="experience_summary" rows={3} placeholder="Share experience that is relevant to this project." />
        </label>
        <label>
          Your proposed budget ({currency}) <span className="dashboard-optional">(optional)</span>
          <input min="0.01" name="proposed_budget" step="0.01" type="number" />
        </label>
        <Feedback state={state} />
        <button className="button dashboard-form-submit" disabled={isPending} type="submit">
          {isPending ? "Sending..." : "Submit application"}
        </button>
      </form>
    </details>
  );
}

export function WithdrawApplicationForm({ applicationId }: { applicationId: string }) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(
    withdrawApplication,
    {},
  );

  return (
    <form action={formAction} className="dashboard-inline-action">
      <input name="application_id" type="hidden" value={applicationId} />
      <button className="dashboard-text-button" disabled={isPending} type="submit">
        {isPending ? "Withdrawing..." : "Withdraw"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CloseJobForm({ jobId }: { jobId: string }) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(
    closeJob,
    {},
  );

  return (
    <form action={formAction} className="dashboard-inline-action">
      <input name="job_id" type="hidden" value={jobId} />
      <button className="dashboard-text-button" disabled={isPending} type="submit">
        {isPending ? "Closing..." : "Close job"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ReviewApplicationForm({
  applicationId,
  status,
}: {
  applicationId: string;
  status: ApplicationStatus;
}) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(
    reviewApplication,
    {},
  );

  return (
    <form action={formAction} className="dashboard-review-form">
      <input name="application_id" type="hidden" value={applicationId} />
      <label className="visually-hidden" htmlFor={`application-${applicationId}-status`}>
        Review application status
      </label>
      <select
        defaultValue={status === "pending" ? "shortlisted" : status}
        id={`application-${applicationId}-status`}
        name="status"
      >
        <option value="shortlisted">Shortlist</option>
        <option value="rejected">Decline</option>
      </select>
      <button className="dashboard-small-button" disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save review"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function AwardApplicationForm({
  applicationId,
  currency,
  suggestedAmount,
}: {
  applicationId: string;
  currency: string;
  suggestedAmount: number | null;
}) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(awardApplication, {});
  return (
    <details className="dashboard-disclosure">
      <summary>Make offer <span aria-hidden="true">+</span></summary>
      <form action={formAction} className="dashboard-form">
        <input name="application_id" type="hidden" value={applicationId} />
        <label>
          Offer amount ({currency})
          <input defaultValue={suggestedAmount ?? ""} min="0.01" name="amount" required step="0.01" type="number" />
        </label>
        <label>
          Instructions <span className="dashboard-optional">(optional)</span>
          <textarea maxLength={4000} name="instructions" rows={3} />
        </label>
        <Feedback state={state} />
        <button className="button dashboard-form-submit" disabled={isPending} type="submit">
          {isPending ? "Sending offer..." : "Send offer"}
        </button>
        <p className="dashboard-form-note">The writer must accept before the assignment starts.</p>
      </form>
    </details>
  );
}

export function OfferResponseForm({ offerId }: { offerId: string }) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(respondToOffer, {});
  return (
    <form action={formAction} className="dashboard-application-actions">
      <input name="offer_id" type="hidden" value={offerId} />
      <button className="button dashboard-form-submit" disabled={isPending} name="response" type="submit" value="accept">
        Accept offer
      </button>
      <button className="dashboard-secondary-button" disabled={isPending} name="response" type="submit" value="decline">
        Decline
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ReviewSubmissionForm({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(reviewWorkSubmission, {});
  return (
    <form action={formAction} className="dashboard-form dashboard-submission-review">
      <input name="assignment_id" type="hidden" value={assignmentId} />
      <label>
        Revision instructions <span className="dashboard-optional">(required for revision)</span>
        <textarea maxLength={4000} name="notes" rows={3} />
      </label>
      <Feedback state={state} />
      <div className="dashboard-form-actions">
        <button className="button dashboard-form-submit" disabled={isPending} name="decision" type="submit" value="approve">
          Approve work
        </button>
        <button className="dashboard-secondary-button" disabled={isPending} name="decision" type="submit" value="revision">
          Request revision
        </button>
      </div>
    </form>
  );
}

export function DashboardMessageForm({
  assignmentId,
  jobId,
  recipientId,
}: {
  assignmentId?: string;
  jobId?: string;
  recipientId: string;
}) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(sendDashboardMessage, {});
  return (
    <form action={formAction} className="dashboard-form dashboard-message-form">
      <input name="assignment_id" type="hidden" value={assignmentId ?? ""} />
      <input name="job_id" type="hidden" value={jobId ?? ""} />
      <input name="recipient_id" type="hidden" value={recipientId} />
      <label className="visually-hidden" htmlFor={`message-${assignmentId ?? jobId}`}>Write a message</label>
      <textarea id={`message-${assignmentId ?? jobId}`} maxLength={5000} name="body" placeholder="Write a message..." required rows={3} />
      <Feedback state={state} />
      <button className="button dashboard-form-submit" disabled={isPending} type="submit">{isPending ? "Sending..." : "Send message"}</button>
    </form>
  );
}

export function WriterProfileForm({
  bio,
  skills,
  portfolioUrl,
}: {
  bio: string;
  skills: string[];
  portfolioUrl: string | null;
}) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(updateWriterProfile, {});
  return <form action={formAction} className="dashboard-form">
    <label>Professional bio<textarea defaultValue={bio} maxLength={2000} name="bio" rows={5} /></label>
    <label>Skills <span className="dashboard-optional">(comma separated)</span><input defaultValue={skills.join(", ")} maxLength={1000} name="skills" placeholder="Research, editing, SEO writing" /></label>
    <label>Portfolio URL<input defaultValue={portfolioUrl ?? ""} name="portfolio_url" placeholder="https://example.com/portfolio" type="url" /></label>
    <Feedback state={state} />
    <button className="button dashboard-form-submit" disabled={isPending} type="submit">{isPending ? "Saving..." : "Save profile"}</button>
  </form>;
}

export function PublishDraftForm({ jobId }: { jobId: string }) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(publishDraft, {});
  return <form action={formAction} className="dashboard-inline-action"><input name="job_id" type="hidden" value={jobId} /><button className="button dashboard-form-submit" disabled={isPending} type="submit">{isPending ? "Submitting..." : "Submit for review"}</button><Feedback state={state} /></form>;
}

export function EditJobForm({ job }: {
  job: { id: string; title: string; category: string; description: string; currency: string; budget_min: number; budget_max: number; word_count: number | null; deadline: string | null };
}) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(updateJob, {});
  return <details className="dashboard-disclosure"><summary>Edit order details</summary><form action={formAction} className="dashboard-form"><input name="job_id" type="hidden" value={job.id} /><div className="dashboard-form-grid"><label>Title<input defaultValue={job.title} maxLength={140} minLength={5} name="title" required /></label><label>Category<input defaultValue={job.category} maxLength={60} name="category" required /></label><label>Minimum budget<input defaultValue={job.budget_min} min="0.01" name="budget_min" required step="0.01" type="number" /></label><label>Maximum budget<input defaultValue={job.budget_max} min="0.01" name="budget_max" required step="0.01" type="number" /></label><label>Currency<select defaultValue={job.currency} name="currency"><option value="KES">KES</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option></select></label><label>Word count<input defaultValue={job.word_count ?? ""} min="1" name="word_count" step="1" type="number" /></label><label>Deadline<input defaultValue={job.deadline ?? ""} name="deadline" type="date" /></label></div><label>Project brief<textarea defaultValue={job.description} maxLength={10000} minLength={30} name="description" required rows={5} /></label><Feedback state={state} /><button className="button dashboard-form-submit" disabled={isPending} type="submit">{isPending ? "Saving..." : "Save order changes"}</button></form></details>;
}

export function AssignmentDisputeForm({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(openAssignmentDispute, {});
  return <details className="dashboard-disclosure"><summary>Open a dispute</summary><form action={formAction} className="dashboard-form"><input name="assignment_id" type="hidden" value={assignmentId} /><label>Describe the issue<textarea maxLength={4000} minLength={10} name="reason" required rows={4} /></label><Feedback state={state} /><button className="dashboard-secondary-button" disabled={isPending} type="submit">{isPending ? "Submitting..." : "Submit dispute"}</button></form></details>;
}

export function AssignmentReviewForm({ assignmentId, revieweeId, revieweeName }: { assignmentId: string; revieweeId: string; revieweeName: string }) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(submitAssignmentReview, {});
  return <details className="dashboard-disclosure"><summary>Review {revieweeName}</summary><form action={formAction} className="dashboard-form"><input name="assignment_id" type="hidden" value={assignmentId} /><input name="reviewee_id" type="hidden" value={revieweeId} /><label>Rating<select defaultValue="5" name="rating"><option value="5">5 — Excellent</option><option value="4">4 — Very good</option><option value="3">3 — Good</option><option value="2">2 — Needs improvement</option><option value="1">1 — Poor</option></select></label><label>Comment <span className="dashboard-optional">(optional)</span><textarea maxLength={2000} name="comment" rows={3} /></label><Feedback state={state} /><button className="button dashboard-form-submit" disabled={isPending} type="submit">{isPending ? "Saving..." : "Submit review"}</button></form></details>;
}

export function CancelAssignmentForm({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(cancelAssignment, {});
  return <details className="dashboard-disclosure"><summary>Cancel assignment</summary><form action={formAction} className="dashboard-form"><input name="assignment_id" type="hidden" value={assignmentId} /><label>Cancellation note <span className="dashboard-optional">(optional)</span><textarea maxLength={1000} name="reason" rows={3} /></label><Feedback state={state} /><button className="dashboard-secondary-button" disabled={isPending} type="submit">{isPending ? "Cancelling..." : "Confirm cancellation"}</button></form></details>;
}

export function DarajaPaymentForm({ paymentId }: { paymentId: string }) {
  const [state, formAction, isPending] = useActionState<DashboardActionState, FormData>(initiateDarajaPayment, {});
  return <form action={formAction} className="dashboard-form dashboard-daraja-form"><input name="payment_id" type="hidden" value={paymentId} /><label>M-PESA phone number<input autoComplete="tel" inputMode="tel" maxLength={16} name="phone_number" placeholder="0712345678" required type="tel" /></label><p className="dashboard-form-note">We’ll send an STK Push for this assignment’s exact KES amount. Confirm it on your phone to complete payment.</p><Feedback state={state} /><button className="button dashboard-form-submit" disabled={isPending} type="submit">{isPending ? "Sending request..." : "Pay with M-PESA"}</button></form>;
}
