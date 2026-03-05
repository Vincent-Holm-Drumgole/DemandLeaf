"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useOnboardingWizardStore } from "@/store/onboarding-wizard-store";

const SOURCE_QUALITY_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  strong: { label: "Strong voice data", variant: "default" },
  mixed: { label: "Good voice data", variant: "secondary" },
  limited: { label: "Limited voice data", variant: "outline" },
  none: { label: "Minimal voice data", variant: "destructive" },
};

export function StepBrand() {
  const crawlResult = useOnboardingWizardStore((s) => s.crawlResult);
  const updateCrawlResult = useOnboardingWizardStore((s) => s.updateCrawlResult);
  const provision = useOnboardingWizardStore((s) => s.provision);
  const isProvisioning = useOnboardingWizardStore((s) => s.isProvisioning);
  const provisionError = useOnboardingWizardStore((s) => s.provisionError);
  const setStep = useOnboardingWizardStore((s) => s.setStep);

  if (!crawlResult) return null;

  const qualityInfo =
    SOURCE_QUALITY_LABELS[crawlResult.voiceProfile.sourceQuality] ??
    SOURCE_QUALITY_LABELS.limited;

  async function handleContinue() {
    const ok = await provision();
    if (ok) setStep(5);
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          We found your brand
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Review what we detected. You can adjust anything here.
        </p>
      </div>

      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Company</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{crawlResult.companyName}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {crawlResult.pagesFound} pages analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Industry</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={crawlResult.industry}
              onChange={(e) => updateCrawlResult({ industry: e.target.value })}
              className="text-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Target Audience</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={crawlResult.audience}
              onChange={(e) => updateCrawlResult({ audience: e.target.value })}
              className="text-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Voice Profile</CardTitle>
              <Badge variant={qualityInfo.variant}>{qualityInfo.label}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {crawlResult.voiceProfile.description}
            </p>
            {crawlResult.voiceProfile.toneAttributes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {crawlResult.voiceProfile.toneAttributes.map((attr) => (
                  <Badge key={attr} variant="outline" className="text-xs">
                    {attr}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {provisionError && (
        <p className="mt-3 text-sm text-destructive text-center">
          {provisionError}
        </p>
      )}

      <Button
        onClick={handleContinue}
        disabled={isProvisioning}
        size="lg"
        className="mt-6 w-full h-12"
      >
        {isProvisioning ? "Setting up..." : "Looks Right"}
      </Button>

      <div className="mt-3 text-center">
        <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
          Back
        </Button>
      </div>
    </div>
  );
}
