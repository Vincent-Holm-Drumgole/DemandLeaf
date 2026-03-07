"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ScoredOutput {
  scoredOutputId: string;
  blogId: string;
  title: string;
  compositeScore: number;
  scoredAt: number;
  lowestDimension: {
    dimension: string;
    label: string;
    score: number;
  };
}

interface ScoredOutputLogProps {
  outputs: ScoredOutput[];
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function scoreColor(score: number) {
  if (score < 5) return "text-red-600";
  if (score < 7) return "text-amber-600";
  return "text-green-600";
}

export function ScoredOutputLog({ outputs }: ScoredOutputLogProps) {
  if (outputs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Scored Outputs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            No scored outputs yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Scored Outputs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {outputs.map((output) => (
            <div
              key={output.scoredOutputId}
              className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{output.title}</p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{formatDate(output.scoredAt)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    Weakest: {output.lowestDimension.label} ({output.lowestDimension.score}/5)
                  </Badge>
                </div>
              </div>
              <span className={cn("text-sm font-semibold shrink-0", scoreColor(output.compositeScore))}>
                {output.compositeScore.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
