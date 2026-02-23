"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useVoiceWizardStore } from "@/store/voice-wizard-store";
import type { WizardStep2Answers } from "@/lib/voice/wizard-translator";

const SLIDERS = [
  {
    id: "formality" as const,
    label: "Formality",
    lowLabel: "Casual & conversational",
    highLabel: "Formal & professional",
  },
  {
    id: "humor" as const,
    label: "Humor",
    lowLabel: "Serious & earnest",
    highLabel: "Witty & playful",
  },
  {
    id: "jargonLevel" as const,
    label: "Jargon Level",
    lowLabel: "Plain language",
    highLabel: "Industry-native",
  },
  {
    id: "sentenceComplexity" as const,
    label: "Sentence Complexity",
    lowLabel: "Short & punchy",
    highLabel: "Long & nuanced",
  },
] as const;

type SliderKey = "formality" | "humor" | "jargonLevel" | "sentenceComplexity";

export function WizardStep2() {
  const saveStep2 = useVoiceWizardStore((s) => s.saveStep2);
  const setStep = useVoiceWizardStore((s) => s.setStep);
  const existing = useVoiceWizardStore((s) => s.step2Answers);

  const [sliders, setSliders] = useState<Record<SliderKey, number>>({
    formality: existing?.formality ?? 5,
    humor: existing?.humor ?? 5,
    jargonLevel: existing?.jargonLevel ?? 5,
    sentenceComplexity: existing?.sentenceComplexity ?? 5,
  });

  const [thoughtLeadershipPositions, setThoughtLeadershipPositions] = useState(
    existing?.thoughtLeadershipPositions.join("\n") ?? ""
  );
  const [brandPhilosophy, setBrandPhilosophy] = useState(
    existing?.brandPhilosophy ?? ""
  );

  function updateSlider(key: SliderKey, value: number) {
    setSliders((prev) => ({ ...prev, [key]: value }));
  }

  function handleNext() {
    const positions = thoughtLeadershipPositions
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);

    const answers: WizardStep2Answers = {
      ...sliders,
      thoughtLeadershipPositions: positions,
      brandPhilosophy: brandPhilosophy.trim(),
    };
    saveStep2(answers);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Style Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Calibrate your brand's communication style.
        </p>
      </div>

      <div className="space-y-6">
        {SLIDERS.map(({ id, label, lowLabel, highLabel }) => (
          <div key={id} className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>{label}</Label>
              <span className="text-sm font-medium tabular-nums w-6 text-right">
                {sliders[id]}
              </span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[sliders[id]]}
              onValueChange={([v]) => updateSlider(id, v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{lowLabel}</span>
              <span>{highLabel}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="thought-leadership">
          Thought leadership positions (one per line, up to 5)
        </Label>
        <Textarea
          id="thought-leadership"
          value={thoughtLeadershipPositions}
          onChange={(e) => setThoughtLeadershipPositions(e.target.value)}
          placeholder={`e.g. Most companies approach security wrong — compliance is a floor, not a ceiling.\nThe best marketing is just teaching people things they actually want to know.`}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Strong POV statements your brand would defend in public.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="brand-philosophy">Brand philosophy (optional)</Label>
        <Textarea
          id="brand-philosophy"
          value={brandPhilosophy}
          onChange={(e) => setBrandPhilosophy(e.target.value)}
          placeholder="e.g. We believe that expertise should be accessible, not gatekept. Every piece of content we create should leave the reader smarter than when they arrived."
          rows={3}
        />
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
          ← Back
        </Button>
        <Button onClick={handleNext} className="flex-1">
          Continue to Calibration →
        </Button>
      </div>
    </div>
  );
}
