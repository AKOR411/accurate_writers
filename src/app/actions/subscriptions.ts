"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { DarajaRequestError, requestDarajaStkPush } from "@/lib/daraja";

export type SubscriptionActionState = {
  error?: string;
  success?: string;
  passwordVerified?: boolean;
  paymentStarted?: boolean;
  customerMessage?: string;
};

const subscriptionPlans = {
  weekly: { amount: 150, durationDays: 7, label: "Weekly Plan" },
  two_weeks: { amount: 275, durationDays: 14, label: "2 Weeks Plan" },
  monthly: { amount: 500, durationDays: 30, label: "Monthly Plan" },
} as const;

type SubscriptionPlanKey = keyof typeof subscriptionPlans;
const reauthCookieName = "aw-subscription-reauth";

function hasRecentAuthentication(authTime: unknown) {
  const timestamp = typeof authTime === "number" ? authTime : Number(authTime);
  const now = Math.floor(Date.now() / 1000);
  return Number.isFinite(timestamp) && timestamp <= now + 30 && now - timestamp <= 5 * 60;
}

async function getWriterAccount() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || typeof userId !== "string") {
    return { error: "Your session has expired. Please sign in again." } as const;
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("email, role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !profile || profile.role !== "writer") {
    return { error: "Only writer accounts can subscribe to a writer plan." } as const;
  }
  return { supabase, userId, profile } as const;
}

export async function verifyWriterSubscriptionPassword(
  _previousState: SubscriptionActionState,
  formData: FormData,
): Promise<SubscriptionActionState> {
  try {
    const account = await getWriterAccount();
    if ("error" in account) return { error: account.error };
    const password = formData.get("password");
    if (typeof password !== "string" || password.length === 0) {
      return { error: "Enter your account password to continue." };
    }

    const { data, error } = await account.supabase.auth.signInWithPassword({
      email: account.profile.email,
      password,
    });
    if (error || data.user?.id !== account.userId) {
      return { error: "The password could not be verified. Check it and try again." };
    }
    const accessToken = data.session?.access_token;
    if (!accessToken) return { error: "Password confirmed, but a secure session could not be created. Sign in again and retry." };
    const { data: refreshedClaims, error: claimsError } = await account.supabase.auth.getClaims(accessToken);
    if (
      claimsError ||
      refreshedClaims?.claims?.sub !== account.userId ||
      !hasRecentAuthentication(refreshedClaims?.claims?.auth_time)
    ) {
      return { error: "Password confirmed, but your session could not be refreshed. Sign in again and retry." };
    }
    const cookieStore = await cookies();
    cookieStore.set(reauthCookieName, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/dashboard",
      maxAge: 5 * 60,
    });
    return { passwordVerified: true };
  } catch {
    return { error: "Could not confirm your password right now. Please try again." };
  }
}

export async function initiateSubscriptionPayment(
  _previousState: SubscriptionActionState,
  formData: FormData,
): Promise<SubscriptionActionState> {
  const account = await getWriterAccount();
  if ("error" in account) return { error: account.error };
  const cookieStore = await cookies();
  const reauthToken = cookieStore.get(reauthCookieName)?.value;
  if (!reauthToken) {
    return { error: "Confirm your account password again before starting payment." };
  }
  const { data: reauthClaims, error: reauthError } = await account.supabase.auth.getClaims(reauthToken);
  if (
    reauthError ||
    reauthClaims?.claims?.sub !== account.userId ||
    !hasRecentAuthentication(reauthClaims?.claims?.auth_time)
  ) return { error: "Confirm your account password again before starting payment." };

  const planKey = formData.get("plan_key");
  if (typeof planKey !== "string" || !Object.hasOwn(subscriptionPlans, planKey)) {
    return { error: "Choose a valid subscription plan." };
  }
  const plan = subscriptionPlans[planKey as SubscriptionPlanKey];
  const rawPhone = String(formData.get("phone_number") ?? "").trim().replace(/[\s()-]/g, "");
  const phoneMatch = /^(?:\+?254|0)?([17]\d{8})$/.exec(rawPhone);
  if (!phoneMatch) return { error: "Enter a valid Kenyan M-PESA number, such as 0712345678." };
  const phone = "254" + phoneMatch[1];

  let service;
  try {
    service = createServiceClient();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Payment service is not configured." };
  }

  const now = new Date().toISOString();
  const { error: expireError } = await service.from("subscriptions")
    .update({ status: "expired" })
    .eq("writer_id", account.userId)
    .eq("status", "active")
    .lte("expires_at", now);
  if (expireError) return { error: "Could not check your current subscription. Please try again." };

  const { data: current, error: currentError } = await service.from("subscriptions")
    .select("id, status")
    .eq("writer_id", account.userId)
    .in("status", ["pending_payment", "active", "payment_review"])
    .maybeSingle();
  if (currentError) return { error: "Could not check your current subscription. Please try again." };
  if (current?.status === "active") return { error: "You already have an active subscription." };
  if (current?.status === "pending_payment") return { error: "A subscription payment is already awaiting confirmation. Check your phone before retrying." };
  if (current?.status === "payment_review") return { error: "Your last payment needs support review before another subscription can be started." };

  cookieStore.delete(reauthCookieName);

  const { data: subscription, error: subscriptionError } = await service.from("subscriptions")
    .insert({
      writer_id: account.userId,
      plan_key: planKey as SubscriptionPlanKey,
      amount: plan.amount,
      currency: "KES",
      duration_days: plan.durationDays,
      status: "pending_payment",
    })
    .select("id")
    .single();
  if (subscriptionError || !subscription) {
    return { error: subscriptionError?.code === "23505" ? "A subscription or payment is already being processed." : "Could not prepare your subscription. Please try again." };
  }

  const { data: attempt, error: attemptError } = await service.from("subscription_payment_attempts")
    .insert({
      subscription_id: subscription.id,
      writer_id: account.userId,
      phone_number: phone,
      amount: plan.amount,
      status: "initiating",
    })
    .select("id")
    .single();
  if (attemptError || !attempt) {
    await service.from("subscriptions").update({ status: "failed" }).eq("id", subscription.id);
    return { error: "Could not prepare the payment request. Please try again." };
  }

  try {
    const stk = await requestDarajaStkPush({
      phone,
      amount: plan.amount,
      reference: subscription.id,
      description: "AW plan",
    });
    const { error: updateError } = await service.from("subscription_payment_attempts")
      .update({
        merchant_request_id: stk.merchantRequestId,
        checkout_request_id: stk.checkoutRequestId,
        status: "pending",
      })
      .eq("id", attempt.id);
    if (updateError) {
      return { error: "M-PESA accepted the request but tracking could not be saved. Do not retry; contact support." };
    }
    revalidatePath("/dashboard/subscribe");
    revalidatePath("/dashboard/active-subscriptions");
    return {
      paymentStarted: true,
      customerMessage: stk.customerMessage,
      success: "M-PESA prompt sent. Approve it on your phone; your plan activates after payment is confirmed.",
    };
  } catch (error) {
    if (error instanceof DarajaRequestError && error.outcomeUnknown) {
      await service.from("subscription_payment_attempts")
        .update({ result_description: error.message.slice(0, 500) })
        .eq("id", attempt.id);
      return { error: error.message };
    }
    await service.from("subscription_payment_attempts")
      .update({
        status: "failed",
        result_description: error instanceof Error ? error.message.slice(0, 500) : "Daraja request failed.",
      })
      .eq("id", attempt.id);
    await service.from("subscriptions").update({ status: "failed" }).eq("id", subscription.id);
    return { error: error instanceof Error ? error.message : "Could not start the M-PESA payment." };
  }
}
