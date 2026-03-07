"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useOnboardingWizardStore } from "@/store/onboarding-wizard-store";

const TONE_OPTIONS = [
  { id: "conversational", label: "Conversational" },
  { id: "professional", label: "Professional" },
  { id: "technical", label: "Technical" },
  { id: "playful", label: "Playful" },
  { id: "empathetic", label: "Empathetic" },
  { id: "direct", label: "Direct" },
  { id: "story-driven", label: "Story-driven" },
];

const FORMALITY_LABELS: Record<number, string> = {
  1: "Very casual",
  2: "Casual",
  3: "Relaxed",
  4: "Approachable",
  5: "Balanced",
  6: "Professional",
  7: "Polished",
  8: "Formal",
  9: "Very formal",
  10: "Academic",
};

export function StepVoice() {
  const toneAttributes = useOnboardingWizardStore((s) => s.toneAttributes);
  const setToneAttributes = useOnboardingWizardStore((s) => s.setToneAttributes);
  const formality = useOnboardingWizardStore((s) => s.formality);
  const setFormality = useOnboardingWizardStore((s) => s.setFormality);
  const avoidWords = useOnboardingWizardStore((s) => s.avoidWords);
  const setAvoidWords = useOnboardingWizardStore((s) => s.setAvoidWords);
  const setStep = useOnboardingWizardStore((s) => s.setStep);
  const [avoidInput, setAvoidInput] = useState("");

  function toggleTone(id: string) {
    if (toneAttributes.includes(id)) {
      setToneAttributes(toneAttributes.filter((t) => t !== id));
    } else {
      setToneAttributes([...toneAttributes, id]);
    }
  }

  function addAvoidWord() {
    const word = avoidInput.trim();
    if (word && !avoidWords.includes(word)) {
      setAvoidWords([...avoidWords, word]);
      setAvoidInput("");
    }
  }

  const canContinue = toneAttributes.length >= 1;

  return (
    <div>
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <MessageSquare className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Your voice
        </h2>
        <p className="mt-2 text-muted-foreground">
          How should your content sound? Pick the tones that match your brand.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Tone (pick 1 or more)</Label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map((tone) => (
              <button
                key={tone.id}
                onClick={() => toggleTone(tone.id)}
                className={`rounded-full px-4 py-2 text-sm border transition-colors ${
                  toneAttributes.includes(tone.id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Formality</Label>
            <span className="text-sm text-muted-foreground">
              {FORMALITY_LABELS[formality] || "Balanced"}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={formality}
            onChange={(e) => setFormality(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Casual</span>
            <span>Formal</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="avoid-words">
            Words to avoid <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="avoid-words"
              placeholder="e.g. synergy, leverage"
              value={avoidInput}
              onChange={(e) => setAvoidInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAvoidWord();
                }
              }}
            />
            <Button variant="outline" onClick={addAvoidWord} disabled={!avoidInput.trim()}>
              Add
            </Button>
          </div>
          {avoidWords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {avoidWords.map((word) => (
                <Badge key={word} variant="secondary" className="gap-1">
                  {word}
                  <button
                    onClick={() => setAvoidWords(avoidWords.filter((w) => w !== word))}
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
        <Button variant="ghost" onClick={() => setStep(3)}>
          Back
        </Button>
        <Button onClick={() => setStep(5)} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
