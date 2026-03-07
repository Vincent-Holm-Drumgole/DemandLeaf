"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { isBillingEnabledClient } from "@/lib/billing-config";

export type PlanStatus =
  | "trial"
  | "active"
  | "past_due"
  | "canceled";

export interface SubscriptionState {
  status: PlanStatus;
  isActive: boolean;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  trialExpired: boolean;
  needsUpgrade: boolean;
}

export function useSubscription(): SubscriptionState {
  const { currentWorkspace: workspace } = useWorkspace();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  if (!isBillingEnabledClient) {
    return {
      status: "active",
      isActive: true,
      isTrialing: false,
      trialDaysLeft: null,
      trialExpired: false,
      needsUpgrade: false,
    };
  }

  const plan = workspace.plan ?? "trial";
  const trialEndsAt = workspace.trialEndsAt ?? 0;
  const trialExpired = plan === "trial" && now > trialEndsAt;
  const isTrialing = plan === "trial" && !trialExpired;
  const trialDaysLeft = isTrialing
    ? Math.max(0, Math.ceil((trialEndsAt - now) / (24 * 60 * 60 * 1000)))
    : null;
  const isActive = plan === "active" || isTrialing;
  const needsUpgrade =
    plan === "canceled" || plan === "past_due" || trialExpired;

  return {
    status: plan as PlanStatus,
    isActive,
    isTrialing,
    trialDaysLeft,
    trialExpired,
    needsUpgrade,
  };
}
