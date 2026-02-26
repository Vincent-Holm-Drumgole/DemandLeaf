"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, ChevronDown, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStrategyStore, WIZARD_STEP } from "@/store/strategy-store";
import type { ClusterResult } from "@/types";

function ClusterNode({ cluster }: { cluster: ClusterResult }) {
  const [expanded, setExpanded] = useState(true);
  const satellites = cluster.keywords.filter((kw) => kw !== cluster.pillarKeyword);

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        className="w-full flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <Crown className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span className="font-semibold">{cluster.pillarKeyword}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {cluster.keywords.length} keywords
        </span>
      </button>
      {expanded && satellites.length > 0 && (
        <ul className="divide-y">
          {satellites.map((kw) => (
            <li key={kw} className="px-4 py-2 text-sm text-muted-foreground pl-10">
              {kw}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WizardStepClusters() {
  const { currentStrategyId, clusters, isClustering, error, runClustering, setStep } =
    useStrategyStore();
  const triggeredStrategyIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      currentStrategyId &&
      clusters.length === 0 &&
      !isClustering &&
      triggeredStrategyIdRef.current !== currentStrategyId
    ) {
      triggeredStrategyIdRef.current = currentStrategyId;
      runClustering(currentStrategyId);
    }
  }, [currentStrategyId, clusters.length, isClustering, runClustering]);

  if (isClustering) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Grouping keywords into topic clusters…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => {
            if (currentStrategyId) {
              triggeredStrategyIdRef.current = null;
              runClustering(currentStrategyId);
            }
          }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Topic Clusters</CardTitle>
        <CardDescription>
          {clusters.length} clusters identified. Each cluster has a pillar keyword (
          <Crown className="h-3 w-3 text-amber-500 inline" />) and satellite keywords.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-auto">
          {clusters.map((cluster, i) => (
            <ClusterNode key={`${cluster.pillarKeyword}-${i}`} cluster={cluster} />
          ))}
          {clusters.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No clusters yet. Discover keywords first.
            </p>
          )}
        </div>
        <Button
          className="w-full mt-4"
          onClick={() => setStep(WIZARD_STEP.CALENDAR)}
          disabled={clusters.length === 0}
        >
          Continue to Calendar
        </Button>
      </CardContent>
    </Card>
  );
}
