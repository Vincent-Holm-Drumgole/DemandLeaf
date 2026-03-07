"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Stats {
  totalScored: number;
  avgComposite: number;
  aiConfidence: number;
  scoredThisMonth: number;
}

interface HeadlineCardsProps {
  stats: Stats;
}

function scoreColor(score: number) {
  if (score < 5) return "text-red-600";
  if (score < 7) return "text-amber-600";
  return "text-green-600";
}

function confidenceLabel(confidence: number) {
  if (confidence <= 20) return "Untrained";
  if (confidence <= 50) return "Learning";
  if (confidence <= 75) return "Calibrated";
  return "Optimized";
}

function confidenceColor(confidence: number) {
  if (confidence <= 20) return "text-red-600";
  if (confidence <= 50) return "text-amber-600";
  return "text-green-600";
}

export function HeadlineCards({ stats }: HeadlineCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Card>
        <CardContent className="pt-4 pb-4 space-y-1">
          <p className="text-xs text-muted-foreground">Workspace Score</p>
          <p className={cn("text-2xl font-bold", scoreColor(stats.avgComposite))}>
            {stats.avgComposite.toFixed(1)}
          </p>
          <p className="text-[10px] text-muted-foreground">out of 10</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total Scored</p>
          <p className="text-2xl font-bold">{stats.totalScored}</p>
          <p className="text-[10px] text-muted-foreground">all time</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-1">
          <p className="text-xs text-muted-foreground">Scored This Month</p>
          <p className="text-2xl font-bold">{stats.scoredThisMonth}</p>
          <p className="text-[10px] text-muted-foreground">outputs reviewed</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-4 space-y-1">
          <p className="text-xs text-muted-foreground">AI Confidence</p>
          <p className={cn("text-2xl font-bold", confidenceColor(stats.aiConfidence))}>
            {Math.round(stats.aiConfidence)}%
          </p>
          <Progress value={stats.aiConfidence} className="h-1.5 mt-1" />
          <p className="text-[10px] text-muted-foreground">
            {confidenceLabel(stats.aiConfidence)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
