"use client";

import { cn } from "@/lib/utils";
import type { ScorecardDimension } from "@/lib/scorecard/tags";
import { SCORECARD_DIMENSIONS, SCORECARD_DIMENSION_WEIGHTS } from "@/lib/scorecard/tags";

interface CompositePreviewProps {
  scores: Partial<Record<ScorecardDimension, number>>;
}

export function CompositePreview({ scores }: CompositePreviewProps) {
  const allScored = SCORECARD_DIMENSIONS.every((d) => scores[d] != null);

  if (!allScored) {
    return (
      <div className="text-center py-3">
        <p className="text-2xl font-bold text-muted-foreground">--</p>
        <p className="text-[11px] text-muted-foreground">Score all 5 dimensions</p>
      </div>
    );
  }

  const composite = Math.round(
    SCORECARD_DIMENSIONS.reduce(
      (sum, d) => sum + (scores[d] ?? 0) * SCORECARD_DIMENSION_WEIGHTS[d],
      0
    ) * 2 * 10
  ) / 10;

  return (
    <div className="text-center py-3">
      <p
        className={cn(
          "text-3xl font-bold",
          composite < 5 ? "text-red-600" : composite < 7 ? "text-amber-600" : "text-green-600"
        )}
      >
        {composite.toFixed(1)}
      </p>
      <p className="text-[11px] text-muted-foreground">Composite Score / 10</p>
    </div>
  );
}
