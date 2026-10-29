import type { Metadata } from "next";
import { Suspense } from "react";
import SignupFlow from "./signup-flow";

export const metadata: Metadata = {
  title: "Create an account | Accurate Writers",
  description:
    "Join Accurate Writers as a freelance writer or an employer looking for writing talent.",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="register-loading" />}>
      <SignupFlow />
    </Suspense>
  );
}
