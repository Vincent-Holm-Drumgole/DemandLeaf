"use client";

import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useOnboardingWizardStore } from "@/store/onboarding-wizard-store";

const EXPERTISE_LEVELS = [
  { id: "beginner", label: "Beginner", desc: "New to the topic, needs basics explained" },
  { id: "intermediate", label: "Intermediate", desc: "Familiar with concepts, wants deeper insights" },
  { id: "advanced", label: "Advanced", desc: "Experienced practitioners, wants expert-level content" },
  { id: "expert", label: "Expert", desc: "Industry leaders, wants cutting-edge perspectives" },
] as const;

export function StepAudience() {
  const audienceDescription = useOnboardingWizardStore((s) => s.audienceDescription);
  const setAudienceDescription = useOnboardingWizardStore((s) => s.setAudienceDescription);
  const audienceExpertise = useOnboardingWizardStore((s) => s.audienceExpertise);
  const setAudienceExpertise = useOnboardingWizardStore((s) => s.setAudienceExpertise);
  const setStep = useOnboardingWizardStore((s) => s.setStep);

  const canContinue = audienceDescription.trim().length >= 5;

  return (
    <div>
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Your audience
        </h2>
        <p className="mt-2 text-muted-foreground">
          Understanding your readers helps us match the right tone and depth.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="audience-desc">Who are you creating content for?</Label>
          <textarea
            id="audience-desc"
            placeholder="e.g. Marketing managers at mid-size B2B companies who are looking for ways to improve their content ROI and rank higher in search."
            value={audienceDescription}
            onChange={(e) => setAudienceDescription(e.target.value)}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>Audience expertise level</Label>
          <div className="grid grid-cols-2 gap-2">
            {EXPERTISE_LEVELS.map((level) => (
              <button
                key={level.id}
                onClick={() => setAudienceExpertise(level.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  audienceExpertise === level.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <p className="text-sm font-medium">{level.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{level.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={() => setStep(2)}>
          Back
        </Button>
        <Button onClick={() => setStep(4)} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
