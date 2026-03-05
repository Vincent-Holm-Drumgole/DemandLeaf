"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingWizardStore } from "@/store/onboarding-wizard-store";

const SETUP_STAGES = [
  { id: "workspace", label: "Creating your workspace" },
  { id: "knowledge_base", label: "Building your knowledge base" },
  { id: "voice", label: "Setting up your brand voice" },
  { id: "strategy", label: "Creating your content strategy" },
] as const;

const STAGE_ORDER = SETUP_STAGES.map((s) => s.id);

export function StepSettingUp() {
  const isSettingUp = useOnboardingWizardStore((s) => s.isSettingUp);
  const setupStage = useOnboardingWizardStore((s) => s.setupStage);
  const setupError = useOnboardingWizardStore((s) => s.setupError);
  const runSetup = useOnboardingWizardStore((s) => s.runSetup);

  const currentIdx = STAGE_ORDER.indexOf(setupStage as typeof STAGE_ORDER[number]);

  return (
    <div className="text-center">
      {!setupError && (
        <div className="mx-auto mb-8 h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
      )}

      <h2 className="text-2xl font-semibold tracking-tight">
        {setupError ? "Something went wrong" : "Setting everything up"}
      </h2>
      <p className="mt-2 text-muted-foreground">
        {setupError
          ? setupError
          : "This takes about 10 seconds. We're using AI to build your content foundation."}
      </p>

      {!setupError && (
        <div className="mt-10 space-y-4 text-left max-w-xs mx-auto">
          {SETUP_STAGES.map((stage, idx) => {
            const isComplete = currentIdx > idx || setupStage === "done";
            const isCurrent = currentIdx === idx && isSettingUp;

            return (
              <div key={stage.id} className="flex items-center gap-3">
                {isComplete ? (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                ) : isCurrent ? (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  </div>
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                  </div>
                )}
                <span
                  className={`text-sm ${
                    isComplete
                      ? "text-foreground"
                      : isCurrent
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {setupError && (
        <Button onClick={runSetup} className="mt-6">
          Try Again
        </Button>
      )}
    </div>
  );
}
