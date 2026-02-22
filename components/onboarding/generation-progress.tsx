"use client";

import { useOnboardingStore } from "@/store/onboarding-store";
import type { PipelineStepStatus } from "@/types";

const STEP_DISPLAY_NAMES = [
  "Researching your topic",
  "Writing in your voice",
  "Checking voice consistency",
  "Optimizing for search",
  "Polishing content",
  "Generating metadata",
  "Running quality checks",
];

function StepIcon({ status }: { status: PipelineStepStatus }) {
  if (status === "complete") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M11.5 3.5L5.5 10.5L2.5 7.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (status === "running") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary">
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white">
        <span className="text-xs font-bold">!</span>
      </div>
    );
  }

  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-muted">
      <div className="h-2 w-2 rounded-full bg-muted" />
    </div>
  );
}

export function GenerationProgress() {
  const { generationSteps, generationError, keyword } = useOnboardingStore();

  const stepMap = new Map(generationSteps.map((s) => [s.name, s]));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-semibold text-foreground text-center">
          Creating your blog post
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Writing about &ldquo;{keyword}&rdquo;
        </p>

        <div className="mt-8 space-y-1">
          {STEP_DISPLAY_NAMES.map((name, i) => {
            const step = stepMap.get(name);
            const status: PipelineStepStatus = step?.status ?? "pending";
            const duration = step?.durationMs;

            return (
              <div key={i} className="flex items-center gap-3 py-2">
                <StepIcon status={status} />
                <span
                  className={`text-sm flex-1 ${
                    status === "running"
                      ? "text-foreground font-medium"
                      : status === "complete"
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                  }`}
                >
                  {name}
                </span>
                {status === "complete" && duration && (
                  <span className="text-xs text-muted-foreground">
                    {(duration / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {generationError && (
          <div className="mt-6 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {generationError}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          This typically takes 30-90 seconds
        </p>
      </div>
    </div>
  );
}
