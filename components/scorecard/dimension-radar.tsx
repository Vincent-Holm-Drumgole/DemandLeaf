"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { SCORECARD_DIMENSION_LABELS } from "@/lib/scorecard/tags";
import type { ScorecardDimension } from "@/lib/scorecard/tags";

interface DimensionAverages {
  brandVoice: number;
  structure: number;
  depthAccuracy: number;
  readability: number;
  onTopicFocus: number;
}

interface DimensionRadarProps {
  averages: DimensionAverages;
}

export function DimensionRadar({ averages }: DimensionRadarProps) {
  const data = (Object.entries(averages) as [ScorecardDimension, number][]).map(
    ([key, value]) => ({
      dimension: SCORECARD_DIMENSION_LABELS[key],
      score: value,
    })
  );

  const hasData = Object.values(averages).some((v) => v > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dimension Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            Score outputs to see dimension breakdown.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Dimension Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid className="stroke-border" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 5]}
              tick={{ fontSize: 10 }}
              tickCount={6}
            />
            <Radar
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
