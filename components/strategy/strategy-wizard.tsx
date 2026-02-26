"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStrategyStore } from "@/store/strategy-store";
import { WizardStepOutcomes } from "./wizard-step-outcomes";
import { WizardStepSeeds } from "./wizard-step-seeds";
import { WizardStepDiscovery } from "./wizard-step-discovery";
import { WizardStepClusters } from "./wizard-step-clusters";
import { WizardStepCalendar } from "./wizard-step-calendar";

type Step = 1 | 2 | 3 | 4 | 5;
const clampStep = (n: number): Step => Math.max(1, Math.min(5, n)) as Step;

const STEPS = [
  { id: 1, label: "Goals" },
  { id: 2, label: "Seeds" },
  { id: 3, label: "Discover" },
  { id: 4, label: "Clusters" },
  { id: 5, label: "Calendar" },
] as const;

interface StrategyWizardProps {
  onComplete: (strategyId: string) => void;
}

export function StrategyWizard({ onComplete }: StrategyWizardProps) {
  const wizardStep = useStrategyStore((s) => s.wizardStep);
  const setStep = useStrategyStore((s) => s.setStep);
  const currentStrategyId = useStrategyStore((s) => s.currentStrategyId);

  const canGoBack = wizardStep > 1;
  const canGoForward = wizardStep < 5 && (wizardStep < 3 || !!currentStrategyId);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step indicator */}
      <nav className="flex items-center gap-0 mb-8">
        {STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                  wizardStep > step.id
                    ? "bg-primary border-primary text-primary-foreground"
                    : wizardStep === step.id
                      ? "border-primary text-primary"
                      : "border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {wizardStep > step.id ? <Check className="h-4 w-4" /> : step.id}
              </div>
              <span
                className={`text-xs mt-1 whitespace-nowrap ${
                  wizardStep === step.id ? "text-primary font-medium" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-12px] ${
                  wizardStep > step.id ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        ))}
      </nav>

      {/* Step content */}
      <div className="min-h-[400px]">
        {wizardStep === 1 && <WizardStepOutcomes />}
        {wizardStep === 2 && <WizardStepSeeds />}
        {wizardStep === 3 && <WizardStepDiscovery />}
        {wizardStep === 4 && <WizardStepClusters />}
        {wizardStep === 5 && (
          <WizardStepCalendar
            onComplete={() => currentStrategyId && onComplete(currentStrategyId)}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep(clampStep(wizardStep - 1))}
          disabled={!canGoBack}
        >
          Back
        </Button>
        {wizardStep < 5 && (
          <Button
            onClick={() => setStep(clampStep(wizardStep + 1))}
            disabled={!canGoForward}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
