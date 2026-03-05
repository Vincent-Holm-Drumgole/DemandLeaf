"use client";

import { useSubscription } from "@/hooks/use-subscription";
import { UpgradeCTA } from "./upgrade-cta";
import { Skeleton } from "@/components/ui/skeleton";

interface PaywallGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PaywallGate({ children, fallback }: PaywallGateProps) {
  const { needsUpgrade, status } = useSubscription();

  if (status === "loading" || status === "no_workspace") {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Skeleton className="h-48 w-full max-w-md rounded-lg" />
      </div>
    );
  }

  if (needsUpgrade) {
    return <>{fallback ?? <UpgradeCTA />}</>;
  }

  return <>{children}</>;
}
