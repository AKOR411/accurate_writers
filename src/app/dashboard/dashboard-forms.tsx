"use client";

import { useActionState } from "react";
import {
  applyToJob,
  closeJob,
  createJob,
  reviewApplication,
  withdrawApplication,
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
        <button className="button dashboard-form-submit" disabled={isPending} type="submit">
          {isPending ? "Submitting..." : "Submit job for review"}
        </button>
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
        <option value="accepted">Accept</option>
        <option value="rejected">Decline</option>
      </select>
      <button className="dashboard-small-button" disabled={isPending} type="submit">
        {isPending ? "Saving..." : "Save review"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
