"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStrategyStore, WIZARD_STEP } from "@/store/strategy-store";

export function WizardStepOutcomes() {
  const { outcomes, targetAudience, name, saveName, saveOutcomes, setStep } = useStrategyStore();

  const [localName, setLocalName] = useState(name);
  const [localOutcomes, setLocalOutcomes] = useState(outcomes);
  const [localAudience, setLocalAudience] = useState(targetAudience);

  const handleContinue = () => {
    if (!localName.trim() || !localOutcomes.trim()) return;
    saveName(localName.trim());
    saveOutcomes(localOutcomes.trim(), localAudience.trim() || undefined);
    setStep(WIZARD_STEP.SEEDS);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Define Your Strategy Goals</CardTitle>
        <CardDescription>
          Tell us what business outcomes you want to achieve with your content.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="strategy-name">Strategy Name</Label>
          <Input
            id="strategy-name"
            placeholder="e.g. Q1 2025 SEO Push"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            required
            aria-required="true"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="outcomes">Business Outcomes</Label>
          <Textarea
            id="outcomes"
            placeholder="e.g. Increase organic traffic by 50%, generate 200 MQLs per month, rank #1 for [core term]…"
            className="min-h-[120px]"
            value={localOutcomes}
            onChange={(e) => setLocalOutcomes(e.target.value)}
            required
            aria-required="true"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audience">
            Target Audience <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="audience"
            placeholder="e.g. B2B SaaS founders, mid-market HR leaders"
            value={localAudience}
            onChange={(e) => setLocalAudience(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          onClick={handleContinue}
          disabled={!localName.trim() || !localOutcomes.trim()}
        >
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}
