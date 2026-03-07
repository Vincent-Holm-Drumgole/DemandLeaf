"use client";

import { useSubscription } from "@/hooks/use-subscription";
import { UpgradeCTA } from "./upgrade-cta";

interface PaywallGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PaywallGate({ children, fallback }: PaywallGateProps) {
  const { needsUpgrade } = useSubscription();

  if (needsUpgrade) {
    return <>{fallback ?? <UpgradeCTA />}</>;
  }

  return <>{children}</>;
}
