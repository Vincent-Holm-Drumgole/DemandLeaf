"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Network } from "lucide-react";
import { BubbleChart } from "@/components/content-map/bubble-chart";
import { GapGrid } from "@/components/content-map/gap-grid";
import { OpportunityList } from "@/components/content-map/opportunity-list";
import { ViewToggle, type ColorMode } from "@/components/content-map/view-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContentMapData, ClusterBubble } from "@/types/content-map";
import { PaywallGate } from "@/components/billing/paywall-gate";

function HealthBar({ value }: { value: number }) {
  const color =
    value >= 70 ? "bg-green-500" : value >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export default function ContentMapPage() {
  const router = useRouter();
  const [data, setData] = useState<ContentMapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>("coverage");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  async function load() {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/content-map", { signal: controller.signal });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Failed to load");
      }
      const json = (await res.json()) as ContentMapData;
      setData(json);
      setLastRefreshed(new Date());
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load content map");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => abortControllerRef.current?.abort();
  }, []);

  const isEmpty =
    !isLoading && data && data.summary.totalClusters === 0;
  const hasAnalysisCap =
    Boolean(
      data?.analysis &&
        (data.analysis.blogsMayBeTruncated ||
          data.analysis.keywordsMayBeTruncated ||
          data.analysis.clustersMayBeTruncated),
    );

  return (
    <PaywallGate>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">Content Map</h1>
            </div>
            <div className="flex items-center gap-3">
              {lastRefreshed && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Refreshed {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
              <ViewToggle value={colorMode} onChange={setColorMode} />
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                disabled={isLoading}
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 py-16 text-center">
            <Network className="h-10 w-10 text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold mb-1">No clusters yet</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Create a strategy, discover keywords, and run clustering to see
              your content landscape here.
            </p>
            <Button asChild>
              <Link href="/strategy">Go to Strategy</Link>
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-[420px] rounded-lg" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Main content */}
        {data && !isLoading && !isEmpty && (
          <>
            {hasAnalysisCap && data.analysis && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Analysis is currently capped to the most recent{" "}
                {data.analysis.blogLimit} blogs, {data.analysis.keywordLimit} keywords, and{" "}
                {data.analysis.clusterLimit} clusters for performance.
              </div>
            )}

            {/* Summary stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-normal">
                    Overall Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HealthBar value={data.summary.overallHealth} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-normal">
                    Clusters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {data.summary.totalClusters}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-normal">
                    Keyword Coverage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {data.summary.coveredKeywords}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{data.summary.totalKeywords}
                    </span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs text-muted-foreground font-normal">
                    Blogs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{data.summary.totalBlogs}</p>
                </CardContent>
              </Card>
            </div>

            {/* Bubble chart + gap grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Topic Clusters</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Bubble size = keyword count · Click a cluster to explore · Red outline = gaps detected
                  </p>
                </CardHeader>
                <CardContent>
                  <BubbleChart
                    clusters={data.clusters}
                    colorMode={colorMode}
                    onClusterClick={(c: ClusterBubble) =>
                      router.push(`/keywords?cluster=${c.id}`)
                    }
                  />
                  {/* Legend */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                    {colorMode === "coverage" && (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                          ≥80% covered
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />
                          50–79%
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
                          &lt;50%
                        </span>
                      </>
                    )}
                    {colorMode === "seo" && (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                          SEO ≥80
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />
                          60–79
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
                          &lt;60
                        </span>
                      </>
                    )}
                    {colorMode === "buyerStage" && (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: "#6ee7b7" }} />
                          Awareness
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: "#93c5fd" }} />
                          Consideration
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: "#fca5a5" }} />
                          Decision
                        </span>
                      </>
                    )}
                    {colorMode === "archetype" && (
                      <span>Colors represent content archetypes (how-to, listicle, guide, etc.)</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold mb-2">Gap Analysis</h2>
                  <GapGrid gaps={data.gaps} />
                </div>
              </div>
            </div>

            {/* Opportunities */}
            <div>
              <h2 className="text-sm font-semibold mb-2">
                Ranked Opportunities
              </h2>
              <OpportunityList opportunities={data.opportunities} />
            </div>
          </>
        )}
        </div>
      </div>
    </PaywallGate>
  );
}
