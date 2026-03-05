"use client";

import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnboardingWizardStore } from "@/store/onboarding-wizard-store";

export function StepBusiness() {
  const companyDescription = useOnboardingWizardStore((s) => s.companyDescription);
  const setCompanyDescription = useOnboardingWizardStore((s) => s.setCompanyDescription);
  const url = useOnboardingWizardStore((s) => s.url);
  const setUrl = useOnboardingWizardStore((s) => s.setUrl);
  const industry = useOnboardingWizardStore((s) => s.industry);
  const setIndustry = useOnboardingWizardStore((s) => s.setIndustry);
  const isCrawling = useOnboardingWizardStore((s) => s.isCrawling);
  const crawlError = useOnboardingWizardStore((s) => s.crawlError);
  const crawlResult = useOnboardingWizardStore((s) => s.crawlResult);
  const startCrawl = useOnboardingWizardStore((s) => s.startCrawl);
  const setStep = useOnboardingWizardStore((s) => s.setStep);

  const canContinue = companyDescription.trim().length >= 10;
  const hasUrl = url.trim().length > 3 && url.includes(".");
  const alreadyCrawled = !!crawlResult;

  async function handleAnalyze() {
    if (hasUrl && !alreadyCrawled && !isCrawling) {
      await startCrawl();
    }
  }

  return (
    <div>
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          About your business
        </h2>
        <p className="mt-2 text-muted-foreground">
          Tell us what your company does so we can create content that fits.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="company-desc">What does your company do?</Label>
          <textarea
            id="company-desc"
            placeholder="e.g. We're a B2B SaaS company that helps marketing teams automate their content workflow. Our platform integrates with CMS tools and uses AI to optimize publishing schedules."
            value={companyDescription}
            onChange={(e) => setCompanyDescription(e.target.value)}
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            2-3 sentences about your product, service, or mission.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="website-url">
            Website URL <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="website-url"
              placeholder="e.g. acme.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isCrawling}
            />
            {hasUrl && !alreadyCrawled && (
              <Button
                variant="outline"
                onClick={handleAnalyze}
                disabled={isCrawling}
                className="shrink-0"
              >
                {isCrawling ? "Analyzing..." : "Analyze"}
              </Button>
            )}
            {alreadyCrawled && (
              <span className="flex items-center text-xs text-primary shrink-0 px-2">
                Analyzed
              </span>
            )}
          </div>
          {crawlError && (
            <p className="text-xs text-muted-foreground">{crawlError}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            placeholder="e.g. SaaS, Healthcare, E-commerce"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button onClick={() => setStep(3)} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
