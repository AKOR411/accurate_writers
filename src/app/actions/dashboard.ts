"use server";

import { revalidatePath } from "next/cache";
import type { ApplicationStatus, AccountRole } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DarajaRequestError, requestDarajaStkPush } from "@/lib/daraja";

export type DashboardActionState = {
  error?: string;
  success?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reviewStatuses: ApplicationStatus[] = ["shortlisted", "rejected"];
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
  const isDraft = readString(formData, "intent") === "draft";
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
    is_draft: isDraft,
    status: "pending",
  });

  if (error) {
    return { error: `Could not post this job: ${error.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/jobs");
  return { success: isDraft ? "Draft saved. You can publish it for administrator review when it is ready." : "Job submitted. It will appear to writers after administrator approval." };
}

export async function publishDraft(_previousState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const account = await getAccountForRole("employer");
  if ("error" in account) return { error: account.error };
  const jobId = readString(formData, "job_id");
  if (!uuidPattern.test(jobId)) return { error: "Select a valid draft." };
  const { data, error } = await account.supabase.from("jobs").update({ is_draft: false, status: "pending" }).eq("id", jobId).eq("employer_id", account.userId).eq("is_draft", true).select("id").maybeSingle();
  if (error) return { error: `Could not submit this draft: ${error.message}` };
  if (!data) return { error: "This draft could not be found." };
  revalidatePath("/dashboard/employer/draft-orders");
  revalidatePath("/dashboard/employer/all-orders");
  revalidatePath("/dashboard");
  revalidatePath("/admin/jobs");
  return { success: "Draft submitted for administrator review." };
}

export async function updateJob(_previousState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const account = await getAccountForRole("employer");
  if ("error" in account) return { error: account.error };
  const jobId = readString(formData, "job_id");
  const title = readString(formData, "title");
  const category = readString(formData, "category");
  const description = readString(formData, "description");
  const currency = readString(formData, "currency").toUpperCase();
  const budgetMin = Number(readString(formData, "budget_min"));
  const budgetMax = Number(readString(formData, "budget_max"));
  const wordCount = readString(formData, "word_count");
  const deadline = readString(formData, "deadline");
  if (!uuidPattern.test(jobId)) return { error: "Select a valid order." };
  if (title.length < 5 || title.length > 140 || category.length < 2 || category.length > 60 || description.length < 30 || description.length > 10000) return { error: "Check the title, category, and brief lengths." };
  if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin <= 0 || budgetMax < budgetMin) return { error: "Enter valid minimum and maximum budgets." };
  if (!supportedCurrencies.has(currency)) return { error: "Choose a supported currency." };
  if (wordCount && (!Number.isInteger(Number(wordCount)) || Number(wordCount) < 1)) return { error: "Word count must be a positive whole number." };
  const { data, error } = await account.supabase.from("jobs").update({
    title, category, description, currency, budget_min: budgetMin, budget_max: budgetMax,
    word_count: wordCount ? Number(wordCount) : null, deadline: deadline || null,
  }).eq("id", jobId).eq("employer_id", account.userId).select("id").maybeSingle();
  if (error) return { error: `Could not update this order: ${error.message}` };
  if (!data) return { error: "This order could not be found." };
  revalidatePath("/dashboard/employer/all-orders");
  revalidatePath("/dashboard/employer/public");
  revalidatePath("/dashboard");
  return { success: "Order updated. The latest details are now shared with eligible writers." };
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
  const experienceSummary = readString(formData, "experience_summary");
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
  if (experienceSummary.length > 4000) {
    return { error: "Keep your experience summary under 4,000 characters." };
  }

  const { data: job, error: jobError } = await account.supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("status", "approved")
    .eq("is_draft", false)
    .is("filled_at", null)
    .maybeSingle();
  if (jobError) return { error: `Could not verify this job: ${jobError.message}` };
  if (!job) return { error: "This job is no longer accepting applications." };

  const { error } = await account.supabase.from("applications").insert({
    job_id: jobId,
    writer_id: account.userId,
    cover_letter: coverLetter,
    proposed_budget: proposedBudget,
    experience_summary: experienceSummary,
    status: "pending",
  });

  if (error?.code === "23505") {
    return { error: "You have already applied for this job." };
  }
  if (error) {
    return { error: `Could not submit your application: ${error.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/my-bids");
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
    .in("status", ["pending", "shortlisted"])
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: `Could not update this application: ${error.message}` };
  }
  if (!data) {
    return { error: "This application was not found for one of your jobs." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/employer/request-bid");
  revalidatePath("/dashboard/my-bids");
  revalidatePath("/admin/applications");
  return { success: "Application review saved." };
}

export async function awardApplication(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const account = await getAccountForRole("employer");
  if ("error" in account) return { error: account.error };
  const applicationId = readString(formData, "application_id");
  const amount = Number(readString(formData, "amount"));
  const instructions = readString(formData, "instructions");
  if (!uuidPattern.test(applicationId)) return { error: "Select a valid application." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a valid offer amount." };
  if (instructions.length > 4000) return { error: "Keep offer instructions under 4,000 characters." };
  const { error } = await account.supabase.rpc("award_job_offer", {
    target_application: applicationId,
    offer_amount: amount,
    offer_instructions: instructions,
  });
  if (error) return { error: `Could not send this offer: ${error.message}` };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/employer/request-bid");
  revalidatePath("/dashboard/offers");
  return { success: "Offer sent. The writer must accept it before work begins." };
}

export async function respondToOffer(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const account = await getAccountForRole("writer");
  if ("error" in account) return { error: account.error };
  const offerId = readString(formData, "offer_id");
  const response = readString(formData, "response");
  if (!uuidPattern.test(offerId) || !["accept", "decline"].includes(response)) {
    return { error: "Choose a valid offer response." };
  }
  const { data, error } = await account.supabase.rpc("respond_to_job_offer", {
    target_offer: offerId,
    accept_offer: response === "accept",
  });
  if (error) return { error: `Could not respond to this offer: ${error.message}` };
  if (response === "accept" && !data) return { error: "This offer has expired. Ask the employer to send a new offer." };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/offers");
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard/employer/in-progress");
  return { success: response === "accept" ? "Offer accepted. Your assignment is ready." : "Offer declined." };
}

export async function registerWorkSubmission(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const account = await getAccountForRole("writer");
  if ("error" in account) return { error: account.error };
  const assignmentId = readString(formData, "assignment_id");
  const storagePath = readString(formData, "storage_path");
  const fileName = readString(formData, "file_name");
  const mimeType = readString(formData, "mime_type");
  const fileSize = Number(readString(formData, "file_size"));
  const comments = readString(formData, "comments");
  if (!uuidPattern.test(assignmentId) || !fileName || !storagePath) {
    return { error: "Choose a valid assignment and uploaded file." };
  }
  if (comments.length > 2000) return { error: "Keep comments under 2,000 characters." };
  const { error } = await account.supabase.rpc("submit_assignment_work", {
    target_assignment: assignmentId,
    file_path: storagePath,
    upload_name: fileName,
    upload_mime: mimeType,
    upload_size: fileSize,
    writer_comments: comments,
  });
  if (error) {
    await account.supabase.storage.from("work-submissions").remove([storagePath]);
    return { error: `Could not submit your work: ${error.message}` };
  }
  revalidatePath("/dashboard/assignments");
  revalidatePath("/dashboard/employer/in-progress");
  return { success: "Your work was submitted for employer review." };
}

export async function reviewWorkSubmission(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const account = await getAccountForRole("employer");
  if ("error" in account) return { error: account.error };
  const assignmentId = readString(formData, "assignment_id");
  const decision = readString(formData, "decision");
  const notes = readString(formData, "notes");
  if (!uuidPattern.test(assignmentId) || !["approve", "revision"].includes(decision)) {
    return { error: "Choose a valid review action." };
  }
  const { error } = await account.supabase.rpc("review_assignment_submission", {
    target_assignment: assignmentId,
    decision,
    notes,
  });
  if (error) return { error: `Could not update the submission: ${error.message}` };
  revalidatePath("/dashboard/employer/in-progress");
  revalidatePath("/dashboard/employer/completed");
  revalidatePath("/dashboard/assignments");
  return { success: decision === "approve" ? "Work approved. A pending payment record was created." : "Revision instructions sent to the writer." };
}

export async function sendDashboardMessage(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const assignmentId = readString(formData, "assignment_id");
  const jobId = readString(formData, "job_id");
  const recipientId = readString(formData, "recipient_id");
  const body = readString(formData, "body");
  const account = await createClient();
  const { data: claims, error: claimsError } = await account.auth.getClaims();
  const senderId = claims?.claims?.sub;
  if (claimsError || typeof senderId !== "string") return { error: "Your session has expired. Please sign in again." };
  if (!uuidPattern.test(recipientId) || (!uuidPattern.test(assignmentId) && !uuidPattern.test(jobId))) {
    return { error: "Choose a valid conversation." };
  }
  if (body.length < 1 || body.length > 5000) return { error: "Messages must be between 1 and 5,000 characters." };
  const { error } = await account.from("messages").insert({
    sender_id: senderId,
    recipient_id: recipientId,
    body,
    assignment_id: assignmentId || null,
    job_id: assignmentId ? null : jobId,
  });
  if (error) return { error: `Could not send your message: ${error.message}` };
  revalidatePath("/dashboard/chat");
  revalidatePath("/dashboard/employer/chat");
  revalidatePath("/dashboard/assignments");
  return { success: "Message sent." };
}

export async function markDashboardNotificationsRead(notificationIds: string[]) {
  const account = await createClient();
  const { error } = await account.rpc("mark_notifications_read", { notification_ids: notificationIds });
  if (error) throw new Error(`Could not update notifications: ${error.message}`);
  revalidatePath("/dashboard");
}

export async function updateWriterProfile(
  _previousState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const account = await getAccountForRole("writer");
  if ("error" in account) return { error: account.error };
  const bio = readString(formData, "bio");
  const skills = [...new Set(readString(formData, "skills").split(",").map((skill) => skill.trim()).filter(Boolean))];
  const portfolioUrl = readString(formData, "portfolio_url");
  if (bio.length > 2000) return { error: "Keep your bio under 2,000 characters." };
  if (skills.length > 20 || skills.some((skill) => skill.length > 50)) return { error: "Enter up to 20 skills, each under 50 characters." };
  if (portfolioUrl) {
    try {
      const parsed = new URL(portfolioUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      return { error: "Enter a valid portfolio URL beginning with https://." };
    }
  }
  const { error } = await account.supabase.from("profiles").update({ bio, skills, portfolio_url: portfolioUrl || null }).eq("id", account.userId);
  if (error) return { error: `Could not update your profile: ${error.message}` };
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/employer/request-bid");
  return { success: "Your writer profile was updated." };
}

export async function openAssignmentDispute(_previousState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || typeof userId !== "string") return { error: "Your session has expired. Please sign in again." };
  const assignmentId = readString(formData, "assignment_id");
  const reason = readString(formData, "reason");
  if (!uuidPattern.test(assignmentId)) return { error: "Select a valid assignment." };
  if (reason.length < 10 || reason.length > 4000) return { error: "Describe the issue in 10 to 4,000 characters." };
  const { error } = await supabase.from("disputes").insert({ assignment_id: assignmentId, opened_by: userId, reason });
  if (error) return { error: `Could not open this dispute: ${error.message}` };
  revalidatePath("/dashboard/disputed");
  revalidatePath("/dashboard/employer/disputed");
  return { success: "Your dispute was recorded for review." };
}

export async function submitAssignmentReview(_previousState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const reviewerId = claims?.claims?.sub;
  if (claimsError || typeof reviewerId !== "string") return { error: "Your session has expired. Please sign in again." };
  const assignmentId = readString(formData, "assignment_id");
  const revieweeId = readString(formData, "reviewee_id");
  const rating = Number(readString(formData, "rating"));
  const comment = readString(formData, "comment");
  if (!uuidPattern.test(assignmentId) || !uuidPattern.test(revieweeId) || !Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose a valid rating." };
  if (comment.length > 2000) return { error: "Keep your review under 2,000 characters." };
  const { error } = await supabase.from("reviews").insert({ assignment_id: assignmentId, reviewer_id: reviewerId, reviewee_id: revieweeId, rating, comment });
  if (error?.code === "23505") return { error: "You have already reviewed this assignment." };
  if (error) return { error: `Could not save your review: ${error.message}` };
  revalidatePath("/dashboard/rating");
  revalidatePath("/dashboard/employer/manage-reviews");
  return { success: "Your review was saved." };
}

export async function cancelAssignment(_previousState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const account = await getAccountForRole("employer");
  if ("error" in account) return { error: account.error };
  const assignmentId = readString(formData, "assignment_id");
  const reason = readString(formData, "reason");
  if (!uuidPattern.test(assignmentId)) return { error: "Select a valid assignment." };
  if (reason.length > 1000) return { error: "Keep the cancellation note under 1,000 characters." };
  const { error } = await account.supabase.rpc("cancel_assignment", { target_assignment: assignmentId, cancellation_reason: reason });
  if (error) return { error: `Could not cancel this assignment: ${error.message}` };
  revalidatePath("/dashboard/employer/in-progress");
  revalidatePath("/dashboard/employer/canceled");
  revalidatePath("/dashboard/canceled");
  return { success: "Assignment cancelled and the writer was notified." };
}

export async function initiateDarajaPayment(_previousState: DashboardActionState, formData: FormData): Promise<DashboardActionState> {
  const account = await getAccountForRole("employer");
  if ("error" in account) return { error: account.error };
  const paymentId = readString(formData, "payment_id");
  const rawPhone = readString(formData, "phone_number").replace(/[\s()-]/g, "");
  const phoneMatch = /^(?:\+?254|0)?([17]\d{8})$/.exec(rawPhone);
  if (!uuidPattern.test(paymentId)) return { error: "Select a valid assignment payment." };
  if (!phoneMatch) return { error: "Enter a valid Kenyan M-PESA number, such as 0712345678." };
  const phone = `254${phoneMatch[1]}`;
  const { data: payment, error: paymentError } = await account.supabase.from("payments")
    .select("id, amount, currency, status, collection_status")
    .eq("id", paymentId).eq("employer_id", account.userId).maybeSingle();
  if (paymentError) return { error: `Could not load this payment: ${paymentError.message}` };
  if (!payment) return { error: "This payment was not found for your account." };
  if (payment.collection_status === "paid") return { error: "The employer has already paid this assignment invoice." };
  if (!(["pending", "failed"] as const).includes(payment.status as "pending" | "failed")) return { error: "This payment already has a request being processed." };
  if (!["pending", "failed"].includes(payment.collection_status)) return { error: "An M-PESA collection request is already processing." };
  if (payment.currency !== "KES" || !Number.isInteger(payment.amount)) return { error: "M-PESA STK Push requires a whole-number KES payment." };

  let service;
  try {
    service = createServiceClient();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Payment service is not configured." };
  }
  const { data: activeAttempt, error: activeError } = await service.from("payment_attempts").select("id")
    .eq("payment_id", paymentId).in("status", ["initiating", "pending"]).maybeSingle();
  if (activeError) return { error: `Could not check existing payment requests: ${activeError.message}` };
  if (activeAttempt) return { error: "An M-PESA request is already active for this payment. Check the previous phone prompt before retrying." };

  const { data: attempt, error: attemptError } = await service.from("payment_attempts").insert({
    payment_id: paymentId,
    employer_id: account.userId,
    phone_number: phone,
    amount: payment.amount,
    status: "initiating",
  }).select("id").single();
  if (attemptError || !attempt) return { error: attemptError?.code === "23505" ? "An M-PESA request is already active for this payment." : `Could not prepare the M-PESA request${attemptError ? `: ${attemptError.message}` : "."}` };

  const { error: processingError } = await service.from("payments").update({ collection_status: "processing", provider: "daraja" }).eq("id", paymentId);
  if (processingError) {
    await service.from("payment_attempts").update({ status: "failed", result_description: "Could not set the payment to processing." }).eq("id", attempt.id);
    return { error: "Could not prepare the payment record. Please try again." };
  }

  try {
    const stk = await requestDarajaStkPush({ phone, amount: payment.amount, paymentId });
    const { error: attemptUpdateError } = await service.from("payment_attempts").update({
      merchant_request_id: stk.merchantRequestId,
      checkout_request_id: stk.checkoutRequestId,
      status: "pending",
    }).eq("id", attempt.id);
    if (attemptUpdateError) return { error: "M-PESA accepted the request, but its tracking record could not be saved. Contact support before retrying." };
  } catch (error) {
    if (error instanceof DarajaRequestError && error.outcomeUnknown) {
      await service.from("payment_attempts").update({ result_description: error.message.slice(0, 500) }).eq("id", attempt.id);
      return { error: error.message };
    }
    await service.from("payment_attempts").update({ status: "failed", result_description: error instanceof Error ? error.message.slice(0, 500) : "Daraja request failed." }).eq("id", attempt.id);
    await service.from("payments").update({ collection_status: "pending" }).eq("id", paymentId).eq("collection_status", "processing");
    return { error: error instanceof Error ? error.message : "Could not start the M-PESA payment." };
  }

  revalidatePath("/dashboard/employer/transaction-history");
  revalidatePath("/dashboard/employer/unpaid");
  revalidatePath("/dashboard/employer/paid");
  revalidatePath("/dashboard/payments");
  return { success: "Payment request sent. Ask the customer to check their phone and enter their M-PESA PIN." };
}
