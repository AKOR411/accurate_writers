import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { isAdminHost } from "@/lib/admin-host";
import SignupFlow from "./signup-flow";

export const metadata: Metadata = {
  title: "Create an account | Accurate Writers",
  description:
    "Join Accurate Writers as a freelance writer or an employer looking for writing talent.",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="register-loading" />}>
      <RegisterPortalContent />
    </Suspense>
  );
}

async function RegisterPortalContent() {
  const requestHeaders = await headers();
  const isAdminPortal = isAdminHost(
    requestHeaders.get("host") ?? requestHeaders.get("x-forwarded-host"),
  );

  return <SignupFlow isAdminPortal={isAdminPortal} />;
}
