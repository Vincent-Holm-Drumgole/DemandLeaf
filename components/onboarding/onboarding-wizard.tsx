"use client";

import { Check } from "lucide-react";
import { useOnboardingWizardStore, type WizardStep } from "@/store/onboarding-wizard-store";
import { StepWelcome } from "./steps/step-welcome";
import { StepWebsite } from "./steps/step-website";
import { StepAnalyzing } from "./steps/step-analyzing";
import { StepBrand } from "./steps/step-brand";
import { StepReady } from "./steps/step-ready";

const STEPS = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Website" },
  { id: 3, label: "Analyze" },
  { id: 4, label: "Brand" },
  { id: 5, label: "Ready" },
] as const;

export function OnboardingWizard() {
  const step = useOnboardingWizardStore((s) => s.step);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <nav className="flex items-center gap-0 mb-10">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                    step > s.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : step === s.id
                        ? "border-primary text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                </div>
                <span
                  className={`text-xs mt-1.5 whitespace-nowrap ${
                    step === s.id
                      ? "text-primary font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-14px] transition-colors ${
                    step > s.id ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </div>
          ))}
        </nav>

        {/* Step content */}
        <div className="min-h-[400px]">
          {step === 1 && <StepWelcome />}
          {step === 2 && <StepWebsite />}
          {step === 3 && <StepAnalyzing />}
          {step === 4 && <StepBrand />}
          {step === 5 && <StepReady />}
        </div>
      </div>
    </div>
  );
}
