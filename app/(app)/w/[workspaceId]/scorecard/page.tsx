"use client";

import { useState } from "react";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { PaywallGate } from "@/components/billing/paywall-gate";
import { ReviewQueue } from "@/components/scorecard/review-queue";
import { ScoreDashboard } from "@/components/scorecard/score-dashboard";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "queue" | "dashboard";

export default function ScorecardPage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const { currentWorkspace } = useWorkspace();
  const [tab, setTab] = useState<Tab>("queue");

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!isSignedIn) return null;

  return (
    <PaywallGate>
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-green-600" />
                <h1 className="text-lg font-semibold">AI Scorecard</h1>
              </div>
              <div className="flex gap-1 rounded-lg border p-0.5 bg-muted/50">
                <Button
                  size="sm"
                  variant={tab === "queue" ? "default" : "ghost"}
                  onClick={() => setTab("queue")}
                  className={cn("text-xs h-7", tab !== "queue" && "text-muted-foreground")}
                >
                  Review Queue
                </Button>
                <Button
                  size="sm"
                  variant={tab === "dashboard" ? "default" : "ghost"}
                  onClick={() => setTab("dashboard")}
                  className={cn("text-xs h-7", tab !== "dashboard" && "text-muted-foreground")}
                >
                  Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6">
          {tab === "queue" ? (
            <ReviewQueue workspaceId={currentWorkspace._id} />
          ) : (
            <ScoreDashboard workspaceId={currentWorkspace._id} />
          )}
        </div>
      </div>
    </PaywallGate>
  );
}
