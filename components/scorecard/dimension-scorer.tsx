"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ReasonTagSelector } from "./reason-tag-selector";
import type { ScorecardDimension } from "@/lib/scorecard/tags";
import {
  SCORECARD_DIMENSION_LABELS,
  SCORECARD_DIMENSION_WEIGHTS,
  SCORECARD_PRESET_TAGS,
} from "@/lib/scorecard/tags";

const SCORE_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

interface DimensionScorerProps {
  dimension: ScorecardDimension;
  score: number | null;
  selectedTags: string[];
  onScoreChange: (score: number) => void;
  onTagsChange: (tags: string[]) => void;
}

export function DimensionScorer({
  dimension,
  score,
  selectedTags,
  onScoreChange,
  onTagsChange,
}: DimensionScorerProps) {
  const label = SCORECARD_DIMENSION_LABELS[dimension];
  const weight = Math.round(SCORECARD_DIMENSION_WEIGHTS[dimension] * 100);
  const presetTags = SCORECARD_PRESET_TAGS[dimension];
  const showTags = score !== null && score <= 3;

  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between">
        <legend className="text-sm font-medium">{label}</legend>
        <Badge variant="outline" className="text-[10px]">
          {weight}%
        </Badge>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label={`${label} score`}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={score === value}
            aria-label={`${SCORE_LABELS[value]} (${value} of 5)`}
            onClick={() => onScoreChange(value)}
            className={cn(
              "flex-1 h-9 rounded-md text-xs font-medium border transition-colors",
              score === value
                ? value <= 2
                  ? "bg-red-100 border-red-300 text-red-700"
                  : value === 3
                    ? "bg-amber-100 border-amber-300 text-amber-700"
                    : "bg-green-100 border-green-300 text-green-700"
                : "bg-card hover:bg-accent/60 border-border text-muted-foreground"
            )}
          >
            {value}
          </button>
        ))}
      </div>
      {score !== null && (
        <p className="text-[11px] text-muted-foreground">{SCORE_LABELS[score]}</p>
      )}
      {showTags && (
        <ReasonTagSelector
          presetTags={[...presetTags]}
          selectedTags={selectedTags}
          onTagsChange={onTagsChange}
        />
      )}
    </fieldset>
  );
}
