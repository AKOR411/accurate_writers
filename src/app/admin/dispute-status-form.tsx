"use client";

import { useActionState } from "react";
import { updateAssignmentDispute } from "@/app/actions/admin";
import type { AdminActionState } from "@/lib/admin-form";

export default function DisputeStatusForm({ id, status, resolution }: { id: string; status: string; resolution: string | null }) {
  const [state, formAction, isPending] = useActionState<AdminActionState, FormData>(updateAssignmentDispute, {});
  return <form action={formAction} className="admin-status-form">
    <input name="id" type="hidden" value={id} />
    <select aria-label="Dispute status" defaultValue={status} name="status"><option value="open">Open</option><option value="under_review">Under review</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>
    <textarea aria-label="Resolution note" defaultValue={resolution ?? ""} maxLength={4000} name="resolution" placeholder="Resolution note (required when resolving)" rows={2} />
    <button disabled={isPending} type="submit">{isPending ? "Saving" : "Save"}</button>
    {(state.error || state.success) && <span className={state.error ? "status-message error" : "status-message success"} role={state.error ? "alert" : "status"}>{state.error ?? state.success}</span>}
  </form>;
}
