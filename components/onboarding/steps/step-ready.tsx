"use client";

import { useRouter } from "next/navigation";
import { Check, Leaf, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingWizardStore } from "@/store/onboarding-wizard-store";

export function StepReady() {
  const router = useRouter();
  const workspaceName = useOnboardingWizardStore((s) => s.workspaceName);
  const setupResult = useOnboardingWizardStore((s) => s.setupResult);
  const reset = useOnboardingWizardStore((s) => s.reset);

  const setupItems = [
    { label: `Workspace "${workspaceName || "Your workspace"}" created`, done: true },
    { label: "14-day free trial activated", done: true },
    {
      label: setupResult?.kbEntriesCreated
        ? `${setupResult.kbEntriesCreated} knowledge base entries created`
        : "Knowledge base ready",
      done: !!setupResult?.kbEntriesCreated,
    },
    { label: "Brand voice configured", done: true },
    {
      label: setupResult?.strategyId
        ? "Content strategy created"
        : "Content strategy (add later)",
      done: !!setupResult?.strategyId,
    },
  ];

  function goToDashboard() {
    reset();
    router.replace("/dashboard");
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Leaf className="h-8 w-8 text-primary" />
      </div>

      <h2 className="text-2xl font-semibold tracking-tight">
        You&apos;re all set!
      </h2>
      <p className="mt-3 text-muted-foreground">
        Your workspace is ready. Here&apos;s what we built for you.
      </p>

      <div className="mt-8 space-y-3 text-left max-w-sm mx-auto">
        {setupItems.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                item.done
                  ? "bg-primary text-primary-foreground"
                  : "border-2 border-muted-foreground/30"
              }`}
            >
              {item.done && <Check className="h-3.5 w-3.5" />}
            </div>
            <span className="text-sm">{item.label}</span>
          </div>
        ))}
      </div>

      {setupResult?.keywordsDiscovering && (
        <p className="mt-4 text-sm text-muted-foreground max-w-sm mx-auto">
          Keyword discovery is running in the background — check the Strategy page in a few minutes.
        </p>
      )}

      <div className="mt-6 p-4 rounded-lg bg-muted/50 text-left max-w-sm mx-auto">
        <p className="text-sm font-medium mb-2">Next steps:</p>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>Generate your first blog post from the dashboard</li>
          <li>Refine your voice in the Voice Builder settings</li>
          <li>Connect WordPress to publish directly</li>
        </ul>
      </div>

      <Button
        onClick={goToDashboard}
        size="lg"
        className="mt-8 w-full h-12 gap-2"
      >
        Go to Dashboard
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
