import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SignupFlow from "@/app/register/signup-flow";
import { isAdminHost } from "@/lib/admin-host";

export const metadata: Metadata = {
  title: "Administrator sign in | Accurate Writers",
  description: "Secure sign-in for Accurate Writers administrators.",
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="register-loading" />}>
      <AdminLoginContent />
    </Suspense>
  );
}

async function AdminLoginContent() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!isAdminHost(host)) {
    redirect("/register?mode=login");
  }

  return (
    <SignupFlow
      homeHref={process.env.NEXT_PUBLIC_SITE_URL ?? "/"}
      isAdminPortal
    />
  );
}
