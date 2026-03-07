"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { apiFetch } from "@/lib/api-fetch";
import { Loader2, CheckCircle2 } from "lucide-react";
import { DimensionScorer } from "./dimension-scorer";
import { CoachingNoteInput } from "./coaching-note-input";
import { CompositePreview } from "./composite-preview";
import { SCORECARD_DIMENSIONS } from "@/lib/scorecard/tags";
import type { ScorecardDimension } from "@/lib/scorecard/tags";

interface ScorecardPanelProps {
  blogId: string;
  onSubmitted: (compositeScore: number) => void;
}

type DimensionScores = Partial<Record<ScorecardDimension, number>>;
type DimensionTags = Record<ScorecardDimension, string[]>;

const emptyTags: DimensionTags = {
  brandVoice: [],
  structure: [],
  depthAccuracy: [],
  readability: [],
  onTopicFocus: [],
};

export function ScorecardPanel({ blogId, onSubmitted }: ScorecardPanelProps) {
  const { currentWorkspace } = useWorkspace();
  const [scores, setScores] = useState<DimensionScores>({});
  const [tags, setTags] = useState<DimensionTags>({ ...emptyTags });
  const [coachingNote, setCoachingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allScored = SCORECARD_DIMENSIONS.every((d) => scores[d] != null);

  function setDimensionScore(dimension: ScorecardDimension, score: number) {
    setScores((prev) => ({ ...prev, [dimension]: score }));
    if (score > 3) {
      setTags((prev) => ({ ...prev, [dimension]: [] }));
    }
  }

  function setDimensionTags(dimension: ScorecardDimension, newTags: string[]) {
    setTags((prev) => ({ ...prev, [dimension]: newTags }));
  }

  async function handleSubmit() {
    if (!allScored || submitting) return;
    setSubmitting(true);
    setError(null);

    const reasonTags = SCORECARD_DIMENSIONS.flatMap((dimension) =>
      tags[dimension].map((tag) => ({ dimension, tag }))
    );

    try {
      const res = await apiFetch("/api/scorecard/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": currentWorkspace._id,
        },
        body: JSON.stringify({
          blogId,
          brandVoice: scores.brandVoice,
          structure: scores.structure,
          depthAccuracy: scores.depthAccuracy,
          readability: scores.readability,
          onTopicFocus: scores.onTopicFocus,
          reasonTags,
          coachingNote: coachingNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }

      const result = await res.json();
      setSubmitted(true);
      onSubmitted(result.compositeScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
          <p className="font-semibold">Score Submitted</p>
          <CompositePreview scores={scores} />
          <p className="text-xs text-muted-foreground">
            Your feedback is now training your AI.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Score This Output</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {SCORECARD_DIMENSIONS.map((dimension) => (
          <div key={dimension}>
            <DimensionScorer
              dimension={dimension}
              score={scores[dimension] ?? null}
              selectedTags={tags[dimension]}
              onScoreChange={(score) => setDimensionScore(dimension, score)}
              onTagsChange={(newTags) => setDimensionTags(dimension, newTags)}
            />
            <Separator className="mt-4" />
          </div>
        ))}

        <CompositePreview scores={scores} />

        <CoachingNoteInput value={coachingNote} onChange={setCoachingNote} />

        {error && (
          <p className="text-xs text-destructive" role="alert" aria-live="polite">
            {error}
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!allScored || submitting}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Submitting...
            </>
          ) : (
            "Submit Scorecard"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
