"use client";

import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStrategyStore, WIZARD_STEP } from "@/store/strategy-store";

export function WizardStepSeeds() {
  const {
    seeds,
    competitorDomains,
    name,
    outcomes,
    targetAudience,
    currentStrategyId,
    saveSeeds,
    setCurrentStrategy,
    setStep,
  } = useStrategyStore();

  const [localSeeds, setLocalSeeds] = useState<string[]>(seeds);
  const [localDomains, setLocalDomains] = useState<string[]>(competitorDomains);
  const [seedInput, setSeedInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSeed = () => {
    const trimmed = seedInput.trim();
    if (trimmed && !localSeeds.includes(trimmed) && localSeeds.length < 10) {
      setLocalSeeds([...localSeeds, trimmed]);
      setSeedInput("");
    }
  };

  const addDomain = () => {
    const trimmed = domainInput.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (trimmed && !localDomains.includes(trimmed) && localDomains.length < 5) {
      setLocalDomains([...localDomains, trimmed]);
      setDomainInput("");
    }
  };

  const handleSeedKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addSeed(); }
  };

  const handleDomainKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addDomain(); }
  };

  const handleContinue = async () => {
    if (localSeeds.length === 0) return;
    setError(null);
    saveSeeds(localSeeds, localDomains);

    setIsSubmitting(true);
    try {
      if (currentStrategyId) {
        const updateResponse = await fetch(`/api/strategy/${currentStrategyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            businessOutcomes: outcomes,
            targetAudience: targetAudience || undefined,
            seedKeywords: localSeeds,
            competitorDomains: localDomains,
          }),
        });
        if (!updateResponse.ok) {
          throw new Error("Failed to update strategy");
        }
        setStep(WIZARD_STEP.DISCOVER);
        return;
      }

      const createResponse = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          businessOutcomes: outcomes,
          targetAudience: targetAudience || undefined,
          seedKeywords: localSeeds,
          competitorDomains: localDomains,
        }),
      });
      if (!createResponse.ok) {
        let message = "Failed to create strategy";
        try {
          const data = await createResponse.json();
          message = data.error ?? message;
        } catch {
          // Non-JSON response
        }
        throw new Error(message);
      }

      const data = await createResponse.json();
      setCurrentStrategy(data.strategyId);
      setStep(WIZARD_STEP.DISCOVER);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create strategy");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seed Keywords &amp; Competitors</CardTitle>
        <CardDescription>
          Add up to 10 seed keywords and up to 5 competitor domains to expand your keyword universe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Seed Keywords (up to 10)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. content marketing"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              onKeyDown={handleSeedKeyDown}
              disabled={localSeeds.length >= 10}
            />
            <Button variant="outline" onClick={addSeed} disabled={!seedInput.trim() || localSeeds.length >= 10}>
              Add
            </Button>
          </div>
          {localSeeds.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {localSeeds.map((seed) => (
                <Badge key={seed} variant="secondary" className="gap-1">
                  {seed}
                  <button
                    type="button"
                    aria-label={`Remove ${seed}`}
                    onClick={() => setLocalSeeds(localSeeds.filter((s) => s !== seed))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Competitor Domains <span className="text-muted-foreground">(optional, up to 5)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. competitor.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={handleDomainKeyDown}
              disabled={localDomains.length >= 5}
            />
            <Button variant="outline" onClick={addDomain} disabled={!domainInput.trim() || localDomains.length >= 5}>
              Add
            </Button>
          </div>
          {localDomains.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {localDomains.map((domain) => (
                <Badge key={domain} variant="outline" className="gap-1">
                  {domain}
                  <button
                    type="button"
                    aria-label={`Remove ${domain}`}
                    onClick={() => setLocalDomains(localDomains.filter((d) => d !== domain))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          className="w-full"
          onClick={handleContinue}
          disabled={localSeeds.length === 0 || isSubmitting}
        >
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}
