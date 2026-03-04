"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ExternalLink } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  trial: "Free Trial",
  active: "Active",
  past_due: "Past Due",
  canceled: "Canceled",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  trial: "secondary",
  active: "default",
  past_due: "destructive",
  canceled: "destructive",
};

export function BillingSettings() {
  const { status, isTrialing, trialDaysLeft, needsUpgrade } = useSubscription();
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError("Failed to start checkout. Please try again.");
        }
      } else {
        setError("Failed to start checkout. Please try again.");
      }
    } catch (err) {
      console.error("[billing] Checkout failed:", err);
      setError("Failed to start checkout. Please try again.");
    }
  }

  async function handleManageSubscription() {
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError("Failed to open billing portal. Please try again.");
        }
      } else {
        setError("Failed to open billing portal. Please try again.");
      }
    } catch (err) {
      console.error("[billing] Portal failed:", err);
      setError("Failed to open billing portal. Please try again.");
    }
  }

  if (status === "loading" || status === "no_workspace") {
    return <p className="text-sm text-muted-foreground py-4">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Current Plan</span>
            <Badge
              variant={STATUS_VARIANTS[status] ?? "outline"}
              className="text-[10px]"
            >
              {STATUS_LABELS[status] ?? status}
            </Badge>
          </div>
          {isTrialing && trialDaysLeft !== null && (
            <p className="text-xs text-muted-foreground">
              {trialDaysLeft === 0
                ? "Your trial expires today"
                : `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining in your free trial`}
            </p>
          )}
          {status === "active" && (
            <p className="text-xs text-muted-foreground">
              Your subscription is active. Manage billing via Stripe.
            </p>
          )}
          {status === "past_due" && (
            <p className="text-xs text-red-600">
              Payment failed. Please update your payment method to continue.
            </p>
          )}
          {status === "canceled" && (
            <p className="text-xs text-red-600">
              Your subscription has been canceled. Subscribe to regain access.
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {needsUpgrade || isTrialing ? (
        <Button onClick={handleSubscribe} className="w-full">
          Subscribe — $99/month
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={handleManageSubscription}
          className="w-full"
        >
          <ExternalLink className="mr-2 h-3.5 w-3.5" />
          Manage Subscription
        </Button>
      )}
    </div>
  );
}
