"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-fetch";
import { HeadlineCards } from "./headline-cards";
import { ScoreTrendChart } from "./score-trend-chart";
import { DimensionRadar } from "./dimension-radar";
import { CommonFailureTags } from "./common-failure-tags";
import { ScoredOutputLog } from "./scored-output-log";

interface DashboardData {
  stats: {
    totalScored: number;
    avgComposite: number;
    dimensionAverages: {
      brandVoice: number;
      structure: number;
      depthAccuracy: number;
      readability: number;
      onTopicFocus: number;
    };
    aiConfidence: number;
    scoredThisMonth: number;
  };
  trend: Array<{ date: string; avgComposite: number; count: number }>;
  topFailureTags: Array<{
    dimension: string;
    dimensionLabel: string;
    tag: string;
    count: number;
  }>;
  recentScores: Array<{
    scoredOutputId: string;
    blogId: string;
    title: string;
    compositeScore: number;
    scoredAt: number;
    lowestDimension: { dimension: string; label: string; score: number };
  }>;
}

interface ScoreDashboardProps {
  workspaceId: string;
}

export function ScoreDashboard({ workspaceId }: ScoreDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/scorecard/dashboard", {
          headers: { "x-workspace-id": workspaceId },
        });
        if (!res.ok) throw new Error("Failed to load dashboard");
        setData(await res.json());
      } catch {
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">{error || "No data available"}</p>;
  }

  return (
    <div className="space-y-6">
      <HeadlineCards stats={data.stats} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScoreTrendChart trend={data.trend} />
        <DimensionRadar averages={data.stats.dimensionAverages} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CommonFailureTags tags={data.topFailureTags} />
        <ScoredOutputLog outputs={data.recentScores} />
      </div>
    </div>
  );
}
