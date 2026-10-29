"use server";

import { revalidatePath } from "next/cache";
import type { ApplicationStatus, AccountRole } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type DashboardActionState = {
  error?: string;
  success?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reviewStatuses: ApplicationStatus[] = ["shortlisted", "accepted", "rejected"];
const supportedCurrencies = new Set(["KES", "USD", "GBP", "EUR"]);

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getAccountForRole(role: AccountRole) {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) {
    return { error: `Could not verify your session: ${claimsError.message}` } as const;
  }

  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") {
    return { error: "Your session has expired. Please sign in again." } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return { error: `Could not verify your account role: ${profileError.message}` } as const;
  }
  if (!profile || profile.role !== role) {
    return { error: `Only ${role}s can perform this action.` } as const;
  }

  return { supabase, userId } as const;
}

export async function createJob(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const account = await getAccountForRole("employer");
  if ("error" in account) {
    return { error: account.error };
  }

  const title = readString(formData, "title");
  const description = readString(formData, "description");
  const category = readString(formData, "category");
  const currency = readString(formData, "currency").toUpperCase();
  const budgetMin = Number(readString(formData, "budget_min"));
  const budgetMax = Number(readString(formData, "budget_max"));
  const rawWordCount = readString(formData, "word_count");
  const rawDeadline = readString(formData, "deadline");
  const wordCount = rawWordCount ? Number(rawWordCount) : null;
  const deadline = rawDeadline || null;
  const parsedDeadline = deadline
    ? Date.parse(`${deadline}T00:00:00.000Z`)
    : null;

  if (title.length < 5 || title.length > 140) {
    return { error: "The job title must be between 5 and 140 characters." };
  }
  if (description.length < 30 || description.length > 10000) {
    return { error: "The brief must be between 30 and 10,000 characters." };
  }
  if (category.length < 2 || category.length > 60) {
    return { error: "Enter a category between 2 and 60 characters." };
  }
  if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) ||
      budgetMin <= 0 || budgetMax < budgetMin) {
    return { error: "Enter valid budgets, with the maximum at least the minimum." };
  }
  if (!supportedCurrencies.has(currency)) {
    return { error: "Choose a valid currency." };
  }
  if (wordCount !== null && (!Number.isInteger(wordCount) || wordCount <= 0)) {
    return { error: "Word count must be a positive whole number." };
  }
  if (
    deadline &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      parsedDeadline === null ||
      !Number.isFinite(parsedDeadline) ||
      new Date(parsedDeadline).toISOString().slice(0, 10) !== deadline)
  ) {
    return { error: "Enter a valid deadline." };
  }

  const { error } = await account.supabase.from("jobs").insert({
    employer_id: account.userId,
    title,
    description,
    category,
    budget_min: budgetMin,
    budget_max: budgetMax,
    currency,
    word_count: wordCount,
    deadline,
    status: "pending",
  });

  if (error) {
    return { error: `Could not post this job: ${error.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/jobs");
  return { success: "Job submitted. It will appear to writers after administrator approval." };
}

export async function applyToJob(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const account = await getAccountForRole("writer");
  if ("error" in account) {
    return { error: account.error };
  }

  const jobId = readString(formData, "job_id");
  const coverLetter = readString(formData, "cover_letter");
  const rawBudget = readString(formData, "proposed_budget");
  const proposedBudget = rawBudget ? Number(rawBudget) : null;

  if (!uuidPattern.test(jobId)) {
    return { error: "Select a valid job listing." };
  }
  if (coverLetter.length < 30 || coverLetter.length > 5000) {
    return { error: "Your application must be between 30 and 5,000 characters." };
  }
  if (proposedBudget !== null && (!Number.isFinite(proposedBudget) || proposedBudget <= 0)) {
    return { error: "Enter a valid proposed budget or leave it blank." };
  }

  const { error } = await account.supabase.from("applications").insert({
    job_id: jobId,
    writer_id: account.userId,
    cover_letter: coverLetter,
    proposed_budget: proposedBudget,
    status: "pending",
  });

  if (error?.code === "23505") {
    return { error: "You have already applied for this job." };
  }
  if (error) {
    return { error: `Could not submit your application: ${error.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/applications");
  return { success: "Your application has been submitted." };
}

export async function withdrawApplication(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const account = await getAccountForRole("writer");
  if ("error" in account) {
    return { error: account.error };
  }

  const applicationId = readString(formData, "application_id");
  if (!uuidPattern.test(applicationId)) {
    return { error: "Select a valid application." };
  }

  const { data, error } = await account.supabase
    .from("applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .eq("writer_id", account.userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: `Could not withdraw your application: ${error.message}` };
  }
  if (!data) {
    return { error: "Only pending applications can be withdrawn." };
  }

  revalidatePath("/dashboard");
  return { success: "Your application has been withdrawn." };
}

export async function closeJob(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const account = await getAccountForRole("employer");
  if ("error" in account) {
    return { error: account.error };
  }

  const jobId = readString(formData, "job_id");
  if (!uuidPattern.test(jobId)) {
    return { error: "Select a valid job listing." };
  }

  const { data, error } = await account.supabase
    .from("jobs")
    .update({ status: "closed" })
    .eq("id", jobId)
    .eq("employer_id", account.userId)
    .in("status", ["pending", "approved"])
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: `Could not close this job: ${error.message}` };
  }
  if (!data) {
    return { error: "This job is already closed or cannot be closed." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/jobs");
  return { success: "This job is now closed." };
}

export async function reviewApplication(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const account = await getAccountForRole("employer");
  if ("error" in account) {
    return { error: account.error };
  }

  const applicationId = readString(formData, "application_id");
  const status = readString(formData, "status") as ApplicationStatus;
  if (!uuidPattern.test(applicationId) || !reviewStatuses.includes(status)) {
    return { error: "Select a valid application status." };
  }

  const { data, error } = await account.supabase
    .from("applications")
    .update({ status })
    .eq("id", applicationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: `Could not update this application: ${error.message}` };
  }
  if (!data) {
    return { error: "This application was not found for one of your jobs." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/applications");
  return { success: "Application review saved." };
}
