"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useVoiceWizardStore } from "@/store/voice-wizard-store";
import type { WizardStep1Answers } from "@/lib/voice/wizard-translator";

const NON_NEGOTIABLES = [
  { id: "contractions_ok", label: "Contractions are fine (it's, we're)" },
  { id: "humor_ok", label: "Humor and wit are welcome" },
  { id: "technical_ok", label: "Technical terms are appropriate" },
  { id: "empathetic", label: "Empathetic, understanding tone" },
  { id: "direct", label: "Direct, no fluff" },
  { id: "storytelling", label: "Story-driven, narrative style" },
];

export function WizardStep1() {
  const saveStep1 = useVoiceWizardStore((s) => s.saveStep1);
  const existing = useVoiceWizardStore((s) => s.step1Answers);

  const [dinnerPartyDescription, setDinnerPartyDescription] = useState(
    existing?.dinnerPartyDescription ?? ""
  );
  const [brandsAdmired, setBrandsAdmired] = useState<string[]>(
    existing?.brandsAdmired ?? ["", "", ""]
  );
  const [nonNegotiables, setNonNegotiables] = useState<string[]>(
    existing?.nonNegotiables ?? []
  );
  const [personalityWords, setPersonalityWords] = useState(
    existing?.brandPersonalityWords?.join(", ") ?? ""
  );
  const [error, setError] = useState<string | null>(null);

  function toggleNonNeg(id: string) {
    setNonNegotiables((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  }

  function setBrand(idx: number, value: string) {
    setBrandsAdmired((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function handleNext() {
    if (!dinnerPartyDescription.trim()) {
      setError("Please describe your brand's voice");
      return;
    }
    const answers: WizardStep1Answers = {
      dinnerPartyDescription: dinnerPartyDescription.trim(),
      brandsAdmired: brandsAdmired.filter(Boolean),
      nonNegotiables,
      brandPersonalityWords: personalityWords
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean)
        .slice(0, 5),
    };
    saveStep1(answers);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Voice Interview</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Help us understand how your brand communicates.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dinner-party">
          How would you describe your brand at a dinner party? *
        </Label>
        <Textarea
          id="dinner-party"
          value={dinnerPartyDescription}
          onChange={(e) => setDinnerPartyDescription(e.target.value)}
          placeholder="e.g. We'd be the person who cuts through the jargon and gives you the real answer, with a bit of self-deprecating humor..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Brands whose writing style you admire (optional)</Label>
        {[0, 1, 2].map((idx) => (
          <Input
            key={idx}
            value={brandsAdmired[idx] ?? ""}
            onChange={(e) => setBrand(idx, e.target.value)}
            placeholder={`Brand ${idx + 1}`}
          />
        ))}
      </div>

      <div className="space-y-2">
        <Label>Your writing non-negotiables (select all that apply)</Label>
        <div className="grid grid-cols-2 gap-2">
          {NON_NEGOTIABLES.map((item) => (
            <Card
              key={item.id}
              className={`cursor-pointer border-2 transition-colors ${
                nonNegotiables.includes(item.id)
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
              onClick={() => toggleNonNeg(item.id)}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                    nonNegotiables.includes(item.id)
                      ? "border-primary bg-primary"
                      : "border-muted-foreground"
                  }`}
                >
                  {nonNegotiables.includes(item.id) && (
                    <span className="text-white text-xs">✓</span>
                  )}
                </div>
                <span className="text-xs">{item.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="personality">Brand personality in 3-5 words (comma-separated)</Label>
        <Input
          id="personality"
          value={personalityWords}
          onChange={(e) => setPersonalityWords(e.target.value)}
          placeholder="e.g. bold, practical, irreverent"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleNext} className="w-full">
        Continue to Style Settings →
      </Button>
    </div>
  );
}
