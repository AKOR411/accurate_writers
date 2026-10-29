"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthFormState } from "@/lib/auth-form";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const roles = ["writer", "employer"] as const;

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getEmailRedirectUrl(): string | null {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : null);

  if (!siteUrl) {
    return null;
  }

  try {
    const url = new URL(siteUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return null;
    }

    return new URL("/auth/callback?next=/dashboard", url).toString();
  } catch {
    return null;
  }
}

export async function signup(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const config = getSupabaseConfig();
  if (!config.configured) {
    return { error: config.message };
  }

  const name = readFormString(formData, "name");
  const email = readFormString(formData, "email").toLowerCase();
  const password = formData.get("password");
  const role = readFormString(formData, "role");

  if (name.length < 2) {
    return { error: "Enter your full name (at least 2 characters)." };
  }
  if (!emailPattern.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Your password must be at least 8 characters." };
  }
  if (!roles.some((validRole) => validRole === role)) {
    return { error: "Choose whether you are signing up as a writer or employer." };
  }

  const emailRedirectTo = getEmailRedirectUrl();
  if (!emailRedirectTo) {
    return {
      error:
        "Set NEXT_PUBLIC_SITE_URL to your website URL before enabling email confirmation.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, role },
      emailRedirectTo,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Supabase did not return a user after signup. Please try again." };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  return {
    success:
      "Check your email for a confirmation link. Your account will be ready after you confirm your address.",
  };
}

export async function login(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const config = getSupabaseConfig();
  if (!config.configured) {
    return { error: config.message };
  }

  const email = readFormString(formData, "email").toLowerCase();
  const password = formData.get("password");

  if (!emailPattern.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Enter your password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("host") ??
    requestHeaders.get("x-forwarded-host")?.split(",")[0].trim();
  let hostname = "";
  if (host) {
    try {
      hostname = new URL(`https://${host}`).hostname.toLowerCase();
    } catch {
      hostname = "";
    }
  }

  const adminHostname = process.env.ADMIN_HOSTNAME?.trim().toLowerCase();
  revalidatePath("/", "layout");
  redirect(hostname && hostname === adminHostname ? "/admin" : "/dashboard");
}

export async function logout(): Promise<void> {
  const config = getSupabaseConfig();
  if (!config.configured) {
    redirect("/");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(`Could not sign out: ${error.message}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}
