"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { login, signup } from "@/app/actions/auth";
import type { AuthFormState } from "@/lib/auth-form";

type AccountRole = "employer" | "writer";
type FlowStep = "role" | "details";

export default function SignupFlow({
  isAdminPortal = false,
  homeHref = "/",
}: {
  isAdminPortal?: boolean;
  homeHref?: string;
}) {
  const searchParams = useSearchParams();
  const requestedRole: AccountRole =
    searchParams.get("role") === "employer" ? "employer" : "writer";
  const requestedMode =
    isAdminPortal || searchParams.get("mode") === "login" ? "login" : "signup";
  const [role, setRole] = useState<AccountRole>(requestedRole);
  const [step, setStep] = useState<FlowStep>(
    requestedMode === "login" ? "details" : "role",
  );
  const [mode, setMode] = useState(requestedMode);
  const [callbackNotice, setCallbackNotice] = useState(() => {
    const error = searchParams.get("error");
    if (error === "configuration") {
      return "Supabase is not configured. Add the project URL and publishable key, then try again.";
    }
    if (error === "confirmation") {
      return "That confirmation link is invalid or expired. Sign in or request a new confirmation email.";
    }
    if (error === "unauthorized") {
      return "This account does not have administrator access.";
    }
    if (error === "session-cleanup") {
      return "Your email is confirmed, but we could not clear the temporary confirmation session. Please sign out before logging in.";
    }
    return "";
  });
  const emailConfirmed = searchParams.get("confirmed") === "1";
  const [actionState, formAction, isPending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? login : signup,
    {},
  );

  function openLogin() {
    setMode("login");
    setStep("details");
    setCallbackNotice("");
  }

  function openSignup() {
    setMode("signup");
    setStep("role");
    setCallbackNotice("");
  }

  return (
    <div className="register-page">
      <header className="register-header">
        <Link className="brand" href={homeHref} aria-label="Accurate Writers home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="M19.9 5.2 26.8 12 13 25.8l-8.3 2.1 2.1-8.3L19.9 5.2Z"
                fill="currentColor"
              />
              <path d="m17.5 7.6 6.9 6.9" stroke="white" strokeWidth="2" />
            </svg>
          </span>
          <span>Accurate Writers</span>
        </Link>
        {!isAdminPortal && (
          <p>
            {mode === "login" ? "New to Accurate Writers?" : "Already have an account?"}
            <a
              href={mode === "login" ? "/register" : "/register?mode=login"}
              onClick={(event) => {
                event.preventDefault();
                if (mode === "login") {
                  openSignup();
                } else {
                  openLogin();
                }
              }}
            >
              {mode === "login" ? " Sign up" : " Log in"}
            </a>
          </p>
        )}
      </header>

      <main className="register-main">
        <section className="register-card" aria-labelledby="register-title">
          <div className="register-heading">
            <p className="section-kicker">
              {isAdminPortal
                ? "ADMINISTRATOR ACCESS"
                : mode === "login"
                  ? "WELCOME BACK"
                  : "JOIN THE COMMUNITY"}
            </p>
            <h1 id="register-title">
              {isAdminPortal
                ? "Sign in to the admin console"
                : mode === "login"
                ? "Log in to your account"
                : step === "role"
                  ? "Create your account"
                  : "A few details to get started"}
            </h1>
            <p>
              {isAdminPortal
                ? "Authorized administrators only."
                : mode === "login"
                ? "Pick up where you left off."
                : step === "role"
                  ? "Choose your role to get started."
                  : `Create your ${role} account.`}
            </p>
          </div>

          {mode === "signup" && step === "role" ? (
            <>
              <div className="role-options" role="group" aria-label="Choose your account type">
                <button
                  className="role-option"
                  type="button"
                  aria-pressed={role === "employer"}
                  onClick={() => setRole("employer")}
                >
                  <span className="role-icon" aria-hidden="true">▤</span>
                  <strong>I&apos;m an Employer</strong>
                  <span>Post jobs, hire talented writers, and get quality content.</span>
                </button>
                <button
                  className="role-option"
                  type="button"
                  aria-pressed={role === "writer"}
                  onClick={() => setRole("writer")}
                >
                  <span className="role-icon" aria-hidden="true">♙</span>
                  <strong>I&apos;m a Writer</strong>
                  <span>Find writing jobs, submit applications, and get paid.</span>
                </button>
              </div>
              <button
                className="button register-continue"
                type="button"
                onClick={() => {
                  setStep("details");
                  setCallbackNotice("");
                }}
              >
                Continue <span aria-hidden="true">→</span>
              </button>
              <div className="register-divider">Or sign up with</div>
              <div className="social-options">
                <button className="social-option" type="button" disabled>
                  Google · coming soon
                </button>
                <button className="social-option" type="button" disabled>
                  Facebook · coming soon
                </button>
              </div>
              <p className="register-terms">
                Your account will be created securely with Supabase.
              </p>
            </>
          ) : (
            <>
              {mode === "signup" && (
                <button
                  className="register-back"
                  type="button"
                  onClick={() => {
                    setStep("role");
                    setCallbackNotice("");
                  }}
                >
                  ← Change account type
                </button>
              )}
              <form action={formAction} className="account-form">
                {mode === "signup" && (
                  <>
                    <input type="hidden" name="role" value={role} />
                    <label>
                      Full name
                      <input
                        name="name"
                        autoComplete="name"
                        minLength={2}
                        placeholder="Your full name"
                        required
                      />
                    </label>
                  </>
                )}
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={mode === "login" ? undefined : 8}
                    placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
                    required
                  />
                </label>
                {mode === "login" && emailConfirmed && !callbackNotice && (
                  <p className="auth-success" role="status">
                    Email confirmed. You can now sign in with the account you created.
                  </p>
                )}
                {(callbackNotice || actionState.error) && (
                  <p className="auth-notice" role="alert">
                    {actionState.error ?? callbackNotice}
                  </p>
                )}
                {actionState.success && (
                  <p className="auth-success" role="status">
                    {actionState.success}
                  </p>
                )}
                <button
                  className="button register-continue"
                  type="submit"
                  disabled={isPending}
                >
                  {isPending
                    ? "Please wait..."
                    : mode === "login"
                      ? "Log in"
                      : "Create account"}
                  <span aria-hidden="true">→</span>
                </button>
              </form>
              {!isAdminPortal && (
                <p className="register-terms">
                  {mode === "login" ? (
                    <Link href="/register">Create a new account</Link>
                  ) : (
                    "Your account will be created securely with Supabase."
                  )}
                </p>
              )}
            </>
          )}
        </section>
      </main>
      <footer className="register-footer">
        © Accurate Writers · Better writing. Better opportunities.
      </footer>
    </div>
  );
}
