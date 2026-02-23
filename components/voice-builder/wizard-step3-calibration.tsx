"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useVoiceWizardStore } from "@/store/voice-wizard-store";
import type { CalibrationRating } from "@/store/voice-wizard-store";

export function WizardStep3Calibration() {
  const {
    calibrationSamples,
    isLoading,
    error,
    wizardCompleted,
    loadCalibrationSamples,
    submitRatings,
    completeWizard,
    setStep,
  } = useVoiceWizardStore();

  const [topic, setTopic] = useState("");
  const [ratings, setRatings] = useState<Record<number, { rating: number; feedback: string }>>({});
  const [submitted, setSubmitted] = useState(false);

  function updateRating(id: number, field: "rating" | "feedback", value: number | string) {
    setRatings((prev) => {
      const existing = prev[id] ?? { rating: 5, feedback: "" };
      if (field === "rating") {
        return {
          ...prev,
          [id]: {
            ...existing,
            rating: typeof value === "number" ? value : existing.rating,
          },
        };
      }
      return {
        ...prev,
        [id]: {
          ...existing,
          feedback: typeof value === "string" ? value : existing.feedback,
        },
      };
    });
  }

  async function handleGenerate() {
    await loadCalibrationSamples(topic.trim() || undefined);
    setRatings({});
    setSubmitted(false);
  }

  async function handleSubmitRatings() {
    if (!calibrationSamples) return;
    const ratingsList: CalibrationRating[] = calibrationSamples.map((s) => ({
      text: s.text,
      rating: ratings[s.id]?.rating ?? 5,
      feedback: ratings[s.id]?.feedback || undefined,
    }));
    await submitRatings(ratingsList);
    if (!useVoiceWizardStore.getState().error) {
      setSubmitted(true);
    }
  }

  async function handleFinish() {
    await completeWizard();
  }

  if (wizardCompleted) {
    return (
      <div className="space-y-6 text-center py-8">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Voice Profile Complete!</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your brand voice profile has been saved. Future blog posts will reflect
            your communication style and preferences.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Voice Calibration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Rate sample paragraphs written in your brand voice to fine-tune the AI.
          High-rated samples (8+) will be used as writing examples.
        </p>
      </div>

      {!calibrationSamples && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cal-topic">Sample topic (optional)</Label>
            <Textarea
              id="cal-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Why most companies get their security strategy backwards"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use a generic brand topic.
            </p>
          </div>

          <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating samples…
              </>
            ) : (
              "Generate Writing Samples"
            )}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {calibrationSamples && !submitted && (
        <div className="space-y-4">
          {calibrationSamples.map((sample) => (
            <Card key={sample.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Sample {sample.id} — {sample.variant}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed">{sample.text}</p>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">How well does this match your voice?</Label>
                    <span className="text-sm font-semibold tabular-nums">
                      {ratings[sample.id]?.rating ?? 5}/10
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[ratings[sample.id]?.rating ?? 5]}
                    onValueChange={([v]) => updateRating(sample.id, "rating", v)}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Not at all</span>
                    <span>Perfect match</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`feedback-${sample.id}`} className="text-xs">
                    What would you change? (optional)
                  </Label>
                  <Textarea
                    id={`feedback-${sample.id}`}
                    value={ratings[sample.id]?.feedback ?? ""}
                    onChange={(e) => updateRating(sample.id, "feedback", e.target.value)}
                    placeholder="e.g. Too formal, needs more contractions; the second sentence is perfect"
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                useVoiceWizardStore.setState({ calibrationSamples: null, error: null });
                setRatings({});
                setSubmitted(false);
              }}
              className="flex-shrink-0"
            >
              Regenerate
            </Button>
            <Button
              onClick={handleSubmitRatings}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit Ratings"
              )}
            </Button>
          </div>
        </div>
      )}

      {submitted && (
        <div className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Ratings submitted! High-scoring samples have been added to your voice examples.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
              ← Back to Style
            </Button>
            <Button onClick={handleFinish} disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Voice Profile"
              )}
            </Button>
          </div>
        </div>
      )}

      {calibrationSamples && !submitted && (
        <div className="pt-2 border-t">
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setStep(2)}
          >
            ← Back to Style Settings
          </button>
        </div>
      )}
    </div>
  );
}
