"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboardingWizardStore } from "@/store/onboarding-wizard-store";

export function StepWebsite() {
  const url = useOnboardingWizardStore((s) => s.url);
  const setUrl = useOnboardingWizardStore((s) => s.setUrl);
  const crawlError = useOnboardingWizardStore((s) => s.crawlError);
  const startCrawl = useOnboardingWizardStore((s) => s.startCrawl);
  const setStep = useOnboardingWizardStore((s) => s.setStep);
  const provision = useOnboardingWizardStore((s) => s.provision);
  const [isSkipping, setIsSkipping] = useState(false);

  const isValidUrl = url.trim().length > 3 && url.includes(".");

  async function handleSkip() {
    setIsSkipping(true);
    const ok = await provision();
    if (ok) {
      setStep(5);
    }
    setIsSkipping(false);
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Globe className="h-8 w-8 text-primary" />
      </div>

      <h2 className="text-2xl font-semibold tracking-tight">
        What&apos;s your website?
      </h2>
      <p className="mt-3 text-muted-foreground">
        We&apos;ll analyze your site to learn your brand voice, audience, and industry.
      </p>

      <div className="mt-10 text-left space-y-2">
        <Label htmlFor="website-url">Website URL</Label>
        <Input
          id="website-url"
          placeholder="e.g. acme.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && isValidUrl) {
              startCrawl();
            }
          }}
        />
        {crawlError && (
          <p className="text-xs text-destructive">{crawlError}</p>
        )}
      </div>

      <Button
        onClick={startCrawl}
        disabled={!isValidUrl}
        size="lg"
        className="mt-8 w-full h-12"
      >
        Analyze My Site
      </Button>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep(1)}
        >
          Back
        </Button>
        <button
          onClick={handleSkip}
          disabled={isSkipping}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isSkipping ? "Setting up..." : "Skip for now"}
        </button>
      </div>
    </div>
  );
}
