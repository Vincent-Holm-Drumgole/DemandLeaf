"use client";

import { useOnboardingStore } from "@/store/onboarding-store";

const CRAWL_STAGES = [
  "Connecting to your website",
  "Reading your pages",
  "Analyzing your brand voice",
  "Classifying your industry",
];

export function CrawlProgress() {
  const { url } = useOnboardingStore();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <h2 className="text-2xl font-semibold text-foreground">
          Analyzing your site
        </h2>
        <p className="mt-2 text-sm text-muted-foreground truncate max-w-sm mx-auto">
          {url}
        </p>

        <div className="mt-8 space-y-3 text-left">
          {CRAWL_STAGES.map((stage, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">{stage}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          This usually takes 10-15 seconds
        </p>
      </div>
    </div>
  );
}
