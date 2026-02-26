"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { Loader2, ArrowLeft, GitBranch, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeywordExplorer } from "@/components/keywords/keyword-explorer";
import { ClusterTreeView } from "@/components/clusters/cluster-tree-view";
import { ContentCalendar } from "@/components/calendar/content-calendar";
import type { ClusterResult } from "@/types";

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
  clusters: (ClusterResult & { _id: string; name: string })[];
}

interface CalendarEntry {
  _id: string;
  strategyId: string;
  keyword: string;
  archetype: string;
  scheduledDate: number;
  priority: number;
  status: string;
  briefId?: string;
  keywordId: string;
}

export default function StrategyDetailPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const params = useParams();
  const strategyId = typeof params?.id === "string" ? params.id : "";

  const [data, setData] = useState<StrategyPageData | null>(null);
  const [calendarItems, setCalendarItems] = useState<CalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !strategyId) return;

    Promise.all([
      fetch(`/api/strategy/${strategyId}`),
      fetch(`/api/calendar?strategyId=${encodeURIComponent(strategyId)}`),
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
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load strategy"),
      )
      .finally(() => setIsLoading(false));
  }, [isLoaded, isSignedIn, strategyId]);

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
        <Button variant="link" onClick={() => router.push("/strategy")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Strategies
        </Button>
      </main>
    );
  }

  const clusterOptions = data.clusters.map((c) => ({ id: c._id, name: c.name }));

  return (
    <main className="container max-w-5xl py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/strategy")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{data.strategy.name}</h1>
          <p className="text-muted-foreground text-sm line-clamp-1">
            {data.strategy.businessOutcomes}
          </p>
        </div>
      </div>

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
          <ClusterTreeView clusters={data.clusters} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ContentCalendar items={calendarItems} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
