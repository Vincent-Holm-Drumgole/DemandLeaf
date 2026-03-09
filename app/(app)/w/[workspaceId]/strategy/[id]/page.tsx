"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, ArrowLeft, GitBranch, CalendarDays, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeywordExplorer } from "@/components/keywords/keyword-explorer";
import { ClusterTreeView } from "@/components/clusters/cluster-tree-view";
import { ContentCalendar } from "@/components/calendar/content-calendar";
import { PaywallGate } from "@/components/billing/paywall-gate";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";
import { useAuthGuard } from "@/hooks/use-auth-guard";

interface StrategyPageData {
  strategy: {
    _id: string;
    name: string;
    businessOutcomes: string;
    status: string;
  };
  keywords: {
    _id: string;
    keyword: string;
    searchVolume?: number;
    keywordDifficulty?: number;
    cpc?: number;
    searchIntent?: string;
    opportunityScore?: number;
    status: string;
    clusterId?: string;
  }[];
  clusters: { _id: string; name: string; pillarKeyword: string }[];
}

interface CalendarEntry {
  _id: string;
  strategyId: string;
  keyword: string;
  archetype: string;
  contentTrack: "evergreen" | "research" | "thought_leadership";
  scheduledDate: number;
  priority: number;
  status: string;
  briefId?: string;
  keywordId: string;
}

export default function StrategyDetailPage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const router = useRouter();
  const params = useParams();
  const { currentWorkspace } = useWorkspace();
  const strategyId = typeof params?.id === "string" ? params.id : "";

  const [data, setData] = useState<StrategyPageData | null>(null);
  const [calendarItems, setCalendarItems] = useState<CalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !strategyId) return;
    const controller = new AbortController();

    Promise.all([
      fetch(`/api/strategy/${strategyId}`, { signal: controller.signal }),
      fetch(`/api/calendar?strategyId=${encodeURIComponent(strategyId)}`, { signal: controller.signal }),
    ])
      .then(async ([strategyResponse, calendarResponse]) => {
        const [strategyData, calendarData] = await Promise.all([
          strategyResponse.json().catch(() => ({})),
          calendarResponse.json().catch(() => ({})),
        ]);

        if (!strategyResponse.ok) {
          throw new Error(strategyData.error ?? "Failed to load strategy");
        }
        if (!calendarResponse.ok) {
          throw new Error(calendarData.error ?? "Failed to load calendar");
        }

        setData(strategyData);
        setCalendarItems(calendarData.items ?? []);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load strategy");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [isLoaded, isSignedIn, strategyId]);

  const reloadData = useCallback(async () => {
    const [strategyRes, calendarRes] = await Promise.all([
      fetch(`/api/strategy/${strategyId}`),
      fetch(`/api/calendar?strategyId=${encodeURIComponent(strategyId)}`),
    ]);
    const [strategyData, calendarData] = await Promise.all([
      strategyRes.json().catch(() => ({})),
      calendarRes.json().catch(() => ({})),
    ]);
    if (strategyRes.ok) setData(strategyData);
    if (calendarRes.ok) setCalendarItems(calendarData.items ?? []);
  }, [strategyId]);

  const handleRunClustering = async () => {
    setActionBusy("clustering");
    setActionError(null);
    try {
      const res = await fetch(`/api/strategy/${strategyId}/clusters`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to run clustering");
      }
      await reloadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Clustering failed");
    } finally {
      setActionBusy(null);
    }
  };

  const handleGenerateCalendar = async () => {
    setActionBusy("calendar");
    setActionError(null);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to generate calendar");
      }
      await reloadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Calendar generation failed");
    } finally {
      setActionBusy(null);
    }
  };

  if (!isLoaded || !isSignedIn) return null;

  if (isLoading) {
    return (
      <main className="container max-w-5xl py-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="container max-w-5xl py-8">
        <p className="text-destructive">{error ?? "Strategy not found."}</p>
        <Button
          variant="link"
          disabled={!currentWorkspace?._id}
          onClick={() => currentWorkspace?._id && router.push(buildWorkspacePath(currentWorkspace._id, "/strategy"))}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Strategies
        </Button>
      </main>
    );
  }

  const clusterOptions = data.clusters.map((c) => ({ id: c._id, name: c.name }));

  // Build ClusterResult objects by cross-referencing keywords with their clusterId
  const enrichedClusters = data.clusters.map((c) => ({
    ...c,
    keywords: data.keywords
      .filter((kw) => kw.clusterId === c._id)
      .map((kw) => kw.keyword),
  }));

  return (
    <PaywallGate>
      <main className="container max-w-5xl py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              disabled={!currentWorkspace?._id}
              onClick={() => currentWorkspace?._id && router.push(buildWorkspacePath(currentWorkspace._id, "/strategy"))}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{data.strategy.name}</h1>
              <p className="text-muted-foreground text-sm line-clamp-1">
                {data.strategy.businessOutcomes}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={actionBusy !== null || data.keywords.length === 0}
              onClick={handleRunClustering}
            >
              {actionBusy === "clustering" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              {data.clusters.length > 0 ? "Re-cluster" : "Run Clustering"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={actionBusy !== null || data.clusters.length === 0}
              onClick={handleGenerateCalendar}
            >
              {actionBusy === "calendar" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              {calendarItems.length > 0 ? "Regenerate Calendar" : "Generate Calendar"}
            </Button>
          </div>
        </div>
        {actionError && (
          <p className="text-sm text-destructive mb-4">{actionError}</p>
        )}

        <Tabs defaultValue="keywords">
          <TabsList>
            <TabsTrigger value="keywords">
              Keywords ({data.keywords.length})
            </TabsTrigger>
            <TabsTrigger value="clusters">
              <GitBranch className="h-4 w-4 mr-1" />
              Clusters ({data.clusters.length})
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDays className="h-4 w-4 mr-1" />
              Calendar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keywords" className="mt-4">
            <KeywordExplorer
              keywords={data.keywords}
              clusterOptions={clusterOptions}
            />
          </TabsContent>

          <TabsContent value="clusters" className="mt-4">
            {enrichedClusters.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No clusters yet</p>
                <p className="text-sm">Click &ldquo;Run Clustering&rdquo; above to group your keywords into topic clusters.</p>
              </div>
            ) : (
              <ClusterTreeView clusters={enrichedClusters} />
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            {calendarItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No calendar items yet</p>
                <p className="text-sm">Run clustering first, then click &ldquo;Generate Calendar&rdquo; to create your content plan.</p>
              </div>
            ) : (
              <ContentCalendar items={calendarItems} />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </PaywallGate>
  );
}
