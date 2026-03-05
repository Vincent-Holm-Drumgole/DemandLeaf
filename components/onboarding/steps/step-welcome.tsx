"use client";

import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboardingWizardStore } from "@/store/onboarding-wizard-store";

export function StepWelcome() {
  const workspaceName = useOnboardingWizardStore((s) => s.workspaceName);
  const setWorkspaceName = useOnboardingWizardStore((s) => s.setWorkspaceName);
  const setStep = useOnboardingWizardStore((s) => s.setStep);

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Leaf className="h-8 w-8 text-primary" />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome to DemandLeaf
      </h1>
      <p className="mt-3 text-muted-foreground">
        AI-powered content that sounds like you wrote it.
        {" "}Let&apos;s get your workspace set up.
      </p>

      <div className="mt-10 text-left space-y-2">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          placeholder="e.g. Acme Corp"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && workspaceName.trim()) {
              setStep(2);
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          You can change this later in settings.
        </p>
      </div>

      <Button
        onClick={() => setStep(2)}
        disabled={!workspaceName.trim()}
        size="lg"
        className="mt-8 w-full h-12"
      >
        Get Started
      </Button>
    </div>
  );
}
