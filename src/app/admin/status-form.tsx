"use client";

import { useActionState } from "react";
import {
  updateApplicationStatus,
  updateJobStatus,
} from "@/app/actions/admin";
import type { AdminActionState } from "@/lib/admin-form";
import type {
  ApplicationStatus,
  JobStatus,
} from "@/lib/supabase/database.types";

type Props = {
  id: string;
  status: JobStatus | ApplicationStatus;
  kind: "job" | "application";
};

const jobStatuses: JobStatus[] = ["pending", "approved", "rejected", "closed"];
const applicationStatuses: ApplicationStatus[] = [
  "pending",
  "shortlisted",
  "accepted",
  "rejected",
  "withdrawn",
];

export default function StatusForm({ id, status, kind }: Props) {
  const action =
    kind === "job" ? updateJobStatus : updateApplicationStatus;
  const [state, formAction, isPending] = useActionState<
    AdminActionState,
    FormData
  >(action, {});
  const statuses =
    kind === "job" ? jobStatuses : applicationStatuses;

  return (
    <form action={formAction} className="admin-status-form">
      <input name="id" type="hidden" value={id} />
      <label className="visually-hidden" htmlFor={`${kind}-${id}-status`}>
        Update {kind} status
      </label>
      <select
        defaultValue={status}
        id={`${kind}-${id}-status`}
        name="status"
      >
        {statuses.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <button disabled={isPending} type="submit">
        {isPending ? "Saving" : "Save"}
      </button>
      {(state.error || state.success) && (
        <span
          className={state.error ? "status-message error" : "status-message success"}
          role={state.error ? "alert" : "status"}
        >
          {state.error ?? state.success}
        </span>
      )}
    </form>
  );
}
