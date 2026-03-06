"use client";

import { useSubscription } from "@/hooks/use-subscription";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";
import Link from "next/link";

export function TrialBanner() {
  const { isTrialing, trialDaysLeft, needsUpgrade, status } = useSubscription();
  const { currentWorkspace } = useWorkspace();

  if (status === "loading" || status === "active" || status === "no_workspace") {
    return null;
  }

  if (isTrialing && trialDaysLeft !== null) {
    return (
      <div className="mx-2 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
        <p className="font-medium text-amber-800">
          {trialDaysLeft === 0
            ? "Trial expires today"
            : `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left in trial`}
        </p>
        <Link
          href={buildWorkspacePath(currentWorkspace._id, "/settings?tab=billing")}
          className="text-amber-600 underline hover:text-amber-700"
        >
          Subscribe now
        </Link>
      </div>
    );
  }

  if (needsUpgrade) {
    return (
      <div className="mx-2 mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
        <p className="font-medium text-red-800">Subscription required</p>
        <Link
          href={buildWorkspacePath(currentWorkspace._id, "/settings?tab=billing")}
          className="text-red-600 underline hover:text-red-700"
        >
          Reactivate
        </Link>
      </div>
    );
  }

  return null;
}
