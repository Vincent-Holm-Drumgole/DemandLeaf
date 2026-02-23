"use client";

import { SeoGauge } from "./seo-gauge";
import { DetectionBadge } from "./detection-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface ScoreSidebarProps {
  scores: {
    seoScore: number | null;
    qualityScore: number | null;
    detectionRisk: string | null;
    detectionRiskScore: number | null;
    burstinessScore: number | null;
    readabilityScore: number | null;
  };
  wordCount: number | null;
  generationTimeMs?: number;
  totalCostCents?: number;
}

export function ScoreSidebar({
  scores,
  wordCount,
  generationTimeMs,
  totalCostCents,
}: ScoreSidebarProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">SEO Score</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <SeoGauge score={scores.seoScore} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Quality Score</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <SeoGauge score={scores.qualityScore} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">AI Detection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <DetectionBadge risk={scores.detectionRisk} />
            {scores.detectionRiskScore !== null && (
              <span className="text-xs text-muted-foreground">
                Score: {scores.detectionRiskScore}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Words</span>
            <span className="font-medium">{wordCount ?? "—"}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Readability</span>
            <span className="font-medium">
              {scores.readabilityScore !== null
                ? scores.readabilityScore.toFixed(0)
                : "—"}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Burstiness</span>
            <span className="font-medium">
              {scores.burstinessScore !== null
                ? scores.burstinessScore.toFixed(1)
                : "—"}
            </span>
          </div>
          {generationTimeMs !== undefined && (
            <>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Generation time</span>
                <span className="font-medium">
                  {generationTimeMs < 1000
                    ? `${generationTimeMs}ms`
                    : `${(generationTimeMs / 1000).toFixed(1)}s`}
                </span>
              </div>
            </>
          )}
          {totalCostCents !== undefined && (
            <>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost</span>
                <span className="font-medium">
                  ${(totalCostCents / 100).toFixed(2)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
