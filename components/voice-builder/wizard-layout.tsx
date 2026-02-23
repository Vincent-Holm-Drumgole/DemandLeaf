"use client";

import { useVoiceWizardStore } from "@/store/voice-wizard-store";

const STEPS = [
  { id: 1, label: "Voice Interview" },
  { id: 2, label: "Style Settings" },
  { id: 3, label: "Calibration" },
] as const;

interface WizardLayoutProps {
  children: React.ReactNode;
}

export function WizardLayout({ children }: WizardLayoutProps) {
  const currentStep = useVoiceWizardStore((s) => s.currentStep);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <nav className="flex items-center gap-0 mb-8">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                  currentStep > step.id
                    ? "bg-primary border-primary text-primary-foreground"
                    : currentStep === step.id
                      ? "border-primary text-primary"
                      : "border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? "✓" : step.id}
              </div>
              <span
                className={`text-xs mt-1 whitespace-nowrap ${
                  currentStep === step.id ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-12px] ${
                  currentStep > step.id ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        ))}
      </nav>

      {children}
    </div>
  );
}
