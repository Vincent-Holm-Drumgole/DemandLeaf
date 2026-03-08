"use client";

import { useEffect, useState } from "react";
import { Loader2, CalendarDays } from "lucide-react";
import { ContentCalendar } from "@/components/calendar/content-calendar";
import type { CalendarEntry } from "@/types/calendar";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { PaywallGate } from "@/components/billing/paywall-gate";

export default function CalendarPage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const [items, setItems] = useState<CalendarEntry[]>([]);
  const [planning, setPlanning] = useState<{
    mix: Array<{ track: string; count: number; percent: number; target: number }>;
    clusterCoverage: Array<{ name: string; pillarKeyword: string; totalKeywords: number; scheduledCount: number; publishedCount: number }>;
    buyerStageGaps: Array<{ buyerStage: string; total: number; uncovered: number }>;
    recommendedTracks: string[];
    seasonalSuggestions: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const controller = new AbortController();

    Promise.all([
      fetch("/api/calendar", { signal: controller.signal }),
      fetch("/api/calendar/planning", { signal: controller.signal }),
    ])
      .then(async ([calendarResponse, planningResponse]) => {
        if (!calendarResponse.ok) {
          const data = await calendarResponse.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load calendar");
        }
        if (!planningResponse.ok) {
          const data = await planningResponse.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load planning overview");
        }
        return Promise.all([calendarResponse.json(), planningResponse.json()]);
      })
      .then(([calendarData, planningData]) => {
        setItems(calendarData.items ?? []);
        setPlanning(planningData ?? null);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load calendar");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <PaywallGate>
      <main className="container max-w-5xl py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> Content Calendar
          </h1>
          <p className="text-muted-foreground">
            Your scheduled content across all strategies.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <div className="space-y-6">
            {planning && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Content Mix
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    {planning.mix.map((item) => (
                      <div key={item.track} className="flex items-center justify-between gap-3">
                        <span className="capitalize">{item.track.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground">
                          {Math.round(item.percent * 100)}% / target {Math.round(item.target * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cluster Coverage
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    {planning.clusterCoverage.length === 0 ? (
                      <p className="text-muted-foreground">No active cluster data yet.</p>
                    ) : (
                      planning.clusterCoverage.slice(0, 4).map((cluster) => (
                        <div key={cluster.name}>
                          <p className="font-medium">{cluster.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {cluster.scheduledCount}/{cluster.totalKeywords} scheduled • {cluster.publishedCount} published
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Planning Signals
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <p>
                      Recommended next tracks: {planning.recommendedTracks.length > 0
                        ? planning.recommendedTracks.map((track) => track.replace(/_/g, " ")).join(", ")
                        : "balanced"}
                    </p>
                    {planning.buyerStageGaps.map((gap) => (
                      <p key={gap.buyerStage}>
                        {gap.buyerStage}: {gap.uncovered}/{gap.total} uncovered
                      </p>
                    ))}
                    {planning.seasonalSuggestions.map((suggestion) => (
                      <p key={suggestion}>{suggestion}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <ContentCalendar items={items} />
          </div>
        )}
      </main>
    </PaywallGate>
  );
}
