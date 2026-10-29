"use server";

import { revalidatePath } from "next/cache";
import type { AdminActionState } from "@/lib/admin-form";
import { assertAdmin } from "@/lib/admin";
import type {
  ApplicationStatus,
  JobStatus,
} from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jobStatuses: JobStatus[] = ["pending", "approved", "rejected", "closed"];
const applicationStatuses: ApplicationStatus[] = [
  "pending",
  "shortlisted",
  "accepted",
  "rejected",
  "withdrawn",
];

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateJobStatus(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const id = getString(formData, "id");
  const status = getString(formData, "status");

  if (!uuidPattern.test(id) || !jobStatuses.includes(status as JobStatus)) {
    return { error: "Select a valid job and status." };
  }

  const supabase = await createClient();
  await assertAdmin(supabase);

  const { error } = await supabase
    .from("jobs")
    .update({ status: status as JobStatus })
    .eq("id", id);

  if (error) {
    return { error: `Could not update the job: ${error.message}` };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/jobs");
  revalidatePath("/admin/reports");
  return { success: "Job status saved." };
}

export async function updateApplicationStatus(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const id = getString(formData, "id");
  const status = getString(formData, "status");

  if (
    !uuidPattern.test(id) ||
    !applicationStatuses.includes(status as ApplicationStatus)
  ) {
    return { error: "Select a valid application and status." };
  }

  const supabase = await createClient();
  await assertAdmin(supabase);

  const { error } = await supabase
    .from("applications")
    .update({ status: status as ApplicationStatus })
    .eq("id", id);

  if (error) {
    return { error: `Could not update the application: ${error.message}` };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/applications");
  revalidatePath("/admin/reports");
  return { success: "Application status saved." };
}
