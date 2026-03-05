"use client";

import { useOnboardingWizardStore } from "@/store/onboarding-wizard-store";

const CRAWL_STAGES = [
  "Connecting to your website",
  "Reading your pages",
  "Analyzing your brand voice",
  "Detecting your industry",
];

export function StepAnalyzing() {
  const url = useOnboardingWizardStore((s) => s.url);

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />

      <h2 className="text-2xl font-semibold tracking-tight">
        Analyzing your site
      </h2>
      <p className="mt-2 text-sm text-muted-foreground truncate max-w-sm mx-auto">
        {url}
      </p>

      <div className="mt-10 space-y-3 text-left max-w-xs mx-auto">
        {CRAWL_STAGES.map((stage, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">{stage}</span>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        This usually takes 10-15 seconds
      </p>
    </div>
  );
}
