"use client";
import Link from "next/link";

import { useActionState, useState, useTransition } from "react";
import {
  initiateSubscriptionPayment,
  verifyWriterSubscriptionPassword,
  type SubscriptionActionState,
} from "@/app/actions/subscriptions";

const plans = [
  { key: "weekly", name: "Weekly Plan", amount: 150, period: "week", tone: "gold" },
  { key: "two_weeks", name: "2 Weeks Plan", amount: 275, period: "2 weeks", tone: "blue" },
  { key: "monthly", name: "Monthly Plan", amount: 500, period: "month", tone: "green" },
] as const;

type Plan = (typeof plans)[number];

function CheckoutDialog({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [step, setStep] = useState<"password" | "payment">("password");
  const [passwordError, setPasswordError] = useState("");
  const [verifying, startVerifying] = useTransition();
  const [paymentState, startPayment, paying] = useActionState<SubscriptionActionState, FormData>(
    initiateSubscriptionPayment,
    {},
  );

  function handlePasswordSubmit(formData: FormData) {
    setPasswordError("");
    startVerifying(async () => {
      const result = await verifyWriterSubscriptionPassword({}, formData);
      if (result.passwordVerified) setStep("payment");
      else setPasswordError(result.error ?? "The password could not be verified.");
    });
  }
  return (
    <div className="subscription-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="subscription-dialog-title" aria-modal="true" className="subscription-dialog" role="dialog">
        <header className="subscription-dialog-header">
          <h2 id="subscription-dialog-title">
            {step === "password"
              ? "Subscription (" + plan.amount.toLocaleString() + " KES / " + plan.period + ")"
              : "M-PESA payment (" + plan.amount.toLocaleString() + " KES)"}
          </h2>
          <button aria-label="Close" className="subscription-dialog-close" onClick={onClose} type="button">{String.fromCharCode(0x00d7)}</button>
        </header>

        {step === "password" ? (
          <form action={handlePasswordSubmit} className="subscription-dialog-body">
            <p>Confirm your account password to continue. We will not store your password.</p>
            <label>Password
              <input autoComplete="current-password" autoFocus name="password" required type="password" />
            </label>
            {passwordError && <p className="subscription-dialog-error" role="alert">{passwordError}</p>}
            <footer className="subscription-dialog-actions">
              <button className="dashboard-secondary-button" onClick={onClose} type="button">Close</button>
              <button className="subscription-dialog-primary" disabled={verifying} type="submit">{verifying ? "Verifying..." : "Continue"}</button>
            </footer>
          </form>
        ) : (
          <form action={startPayment} className="subscription-dialog-body">
            <input name="plan_key" type="hidden" value={plan.key} />
            <p>KES {plan.amount.toLocaleString()} will be charged through M-PESA after you approve the prompt on your phone.</p>
            <label>Phone number
              <input autoComplete="tel" inputMode="tel" maxLength={16} name="phone_number" placeholder="0712345678" required type="tel" />
            </label>
            <label>Amount
              <input aria-readonly="true" readOnly value={"KES " + plan.amount.toLocaleString()} />
            </label>
            {paymentState.error && <p className="subscription-dialog-error" role="alert">{paymentState.error}</p>}
            {paymentState.paymentStarted ? (
              <div className="subscription-dialog-success" role="status">
                <strong>Payment request sent</strong>
                <p>{paymentState.customerMessage ?? paymentState.success}</p>
                <p>Your subscription activates after Daraja confirms the payment.</p>
              </div>
            ) : null}
            <footer className="subscription-dialog-actions">
              <button className="dashboard-secondary-button" onClick={onClose} type="button">Close</button>
              {!paymentState.paymentStarted && <button className="subscription-dialog-primary" disabled={paying} type="submit">{paying ? "Sending..." : "Pay now"}</button>}
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

export default function SubscriptionPlans({ subscriptionStatus }: { subscriptionStatus: "available" | "active" | "pending_payment" | "payment_review" }) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  return (
    <>
      <div className="subscription-plan-notice" role="note">
        <span className="subscription-plan-notice-icon" aria-hidden="true">i</span>
        {subscriptionStatus === "available" ? (
          <p><strong>You do not have an active subscription.</strong> Escrowed orders may carry a 15% platform fee. Choose a plan below to subscribe.</p>
        ) : subscriptionStatus === "active" ? (
          <p><strong>Your subscription is active.</strong> <Link href="/dashboard/active-subscriptions">View your subscription</Link>.</p>
        ) : subscriptionStatus === "pending_payment" ? (
          <p><strong>Payment is awaiting confirmation.</strong> Check your phone for the M-PESA prompt before trying again.</p>
        ) : (
          <p><strong>Your payment needs review.</strong> Contact support before starting another subscription payment.</p>
        )}
      </div>
      <div className="subscription-plan-content">
        <div className="subscription-plan-heading">
          <p className="dashboard-eyebrow">MEMBERSHIP</p>
          <h2>Pricing plans</h2>
          <p>Choose the access period that works best for you.</p>
        </div>
        <div className="subscription-plan-grid">
          {plans.map((plan) => (
            <article className={"subscription-plan-card subscription-plan-" + plan.tone} key={plan.key}>
              <h3>{plan.name}</h3>
              <p className="subscription-plan-price"><strong>KES {plan.amount.toLocaleString()}</strong><span> / {plan.period}</span></p>
              <ul>
                <li>Access to orders</li>
                <li>24/7 support</li>
                <li>SMS notifications</li>
                <li>Email notifications</li>
              </ul>
              <button className="subscription-plan-button" disabled={subscriptionStatus !== "available"} onClick={() => setSelectedPlan(plan)} type="button">{subscriptionStatus === "active" ? "Current plan" : subscriptionStatus === "pending_payment" ? "Payment pending" : subscriptionStatus === "payment_review" ? "Under review" : "Subscribe"}</button>
            </article>
          ))}
        </div>
      </div>
      {selectedPlan && <CheckoutDialog key={selectedPlan.key} onClose={() => setSelectedPlan(null)} plan={selectedPlan} />}
    </>
  );
}
