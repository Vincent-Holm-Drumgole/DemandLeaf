"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useOnboardingWizardStore } from "@/store/onboarding-wizard-store";

export function StepGoals() {
  const businessOutcomes = useOnboardingWizardStore((s) => s.businessOutcomes);
  const setBusinessOutcomes = useOnboardingWizardStore((s) => s.setBusinessOutcomes);
  const seedKeywords = useOnboardingWizardStore((s) => s.seedKeywords);
  const setSeedKeywords = useOnboardingWizardStore((s) => s.setSeedKeywords);
  const competitorDomains = useOnboardingWizardStore((s) => s.competitorDomains);
  const setCompetitorDomains = useOnboardingWizardStore((s) => s.setCompetitorDomains);
  const runSetup = useOnboardingWizardStore((s) => s.runSetup);
  const setStep = useOnboardingWizardStore((s) => s.setStep);

  const [keywordInput, setKeywordInput] = useState("");
  const [domainInput, setDomainInput] = useState("");

  function addKeyword() {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !seedKeywords.includes(kw) && seedKeywords.length < 20) {
      setSeedKeywords([...seedKeywords, kw]);
      setKeywordInput("");
    }
  }

  function addDomain() {
    const d = domainInput.trim().toLowerCase();
    if (d && !competitorDomains.includes(d) && competitorDomains.length < 5) {
      setCompetitorDomains([...competitorDomains, d]);
      setDomainInput("");
    }
  }

  return (
    <div>
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Target className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Content goals
        </h2>
        <p className="mt-2 text-muted-foreground">
          What do you want your content to achieve? We&apos;ll build a strategy around your goals.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="outcomes">
            Business outcomes <span className="text-muted-foreground">(optional)</span>
          </Label>
          <textarea
            id="outcomes"
            placeholder="e.g. Rank on page 1 for SaaS marketing terms, generate 200 inbound leads per month, establish thought leadership in our space."
            value={businessOutcomes}
            onChange={(e) => setBusinessOutcomes(e.target.value)}
            className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seed-keywords">
            Seed keywords <span className="text-muted-foreground">(optional, 3-5 recommended)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="seed-keywords"
              placeholder="e.g. content marketing"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKeyword();
                }
              }}
            />
            <Button
              variant="outline"
              onClick={addKeyword}
              disabled={!keywordInput.trim() || seedKeywords.length >= 20}
            >
              Add
            </Button>
          </div>
          {seedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {seedKeywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="gap-1">
                  {kw}
                  <button
                    onClick={() => setSeedKeywords(seedKeywords.filter((k) => k !== kw))}
                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            We&apos;ll discover hundreds of keyword opportunities from these seeds.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="competitors">
            Competitor domains <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="competitors"
              placeholder="e.g. competitor.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDomain();
                }
              }}
            />
            <Button
              variant="outline"
              onClick={addDomain}
              disabled={!domainInput.trim() || competitorDomains.length >= 5}
            >
              Add
            </Button>
          </div>
          {competitorDomains.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {competitorDomains.map((d) => (
                <Badge key={d} variant="secondary" className="gap-1">
                  {d}
                  <button
                    onClick={() => setCompetitorDomains(competitorDomains.filter((x) => x !== d))}
                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={() => setStep(4)}>
          Back
        </Button>
        <Button onClick={runSetup} size="lg" className="h-11">
          Set Up My Workspace
        </Button>
      </div>
    </div>
  );
}
