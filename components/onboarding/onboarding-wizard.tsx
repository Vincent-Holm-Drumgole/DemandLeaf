"use client";

import { Check } from "lucide-react";
import { useOnboardingWizardStore, type WizardStep } from "@/store/onboarding-wizard-store";
import { StepWelcome } from "./steps/step-welcome";
import { StepBusiness } from "./steps/step-business";
import { StepAudience } from "./steps/step-audience";
import { StepVoice } from "./steps/step-voice";
import { StepGoals } from "./steps/step-goals";
import { StepSettingUp } from "./steps/step-setting-up";
import { StepReady } from "./steps/step-ready";

const STEPS = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Business" },
  { id: 3, label: "Audience" },
  { id: 4, label: "Voice" },
  { id: 5, label: "Goals" },
  { id: 6, label: "Setup" },
  { id: 7, label: "Ready" },
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
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                    step > s.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : step === s.id
                        ? "border-primary text-primary"
                        : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
                </div>
                <span
                  className={`text-[10px] mt-1 whitespace-nowrap ${
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
                  className={`flex-1 h-0.5 mx-1 mt-[-14px] transition-colors ${
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
          {step === 2 && <StepBusiness />}
          {step === 3 && <StepAudience />}
          {step === 4 && <StepVoice />}
          {step === 5 && <StepGoals />}
          {step === 6 && <StepSettingUp />}
          {step === 7 && <StepReady />}
        </div>
      </div>
    </div>
  );
}
