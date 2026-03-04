"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ClusterResult } from "@/types";

interface ClusterTreeViewProps {
  clusters: ClusterResult[];
}

function ClusterNode({ cluster }: { cluster: ClusterResult }) {
  const [expanded, setExpanded] = useState(true);
  const satellites = cluster.keywords.filter((kw) => kw !== cluster.pillarKeyword);

  return (
    <div className="border rounded-md overflow-hidden">
      <button
        className="w-full flex items-center gap-2 p-3 bg-muted/40 hover:bg-muted text-left transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <Crown className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span className="font-semibold">{cluster.pillarKeyword}</span>
        <Badge variant="outline" className="ml-auto text-xs">
          {cluster.keywords.length} keywords
        </Badge>
      </button>
      {expanded && satellites.length > 0 && (
        <ul className="divide-y border-t">
          {satellites.map((kw) => (
            <li key={kw} className="px-4 py-2 text-sm text-muted-foreground pl-10 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 flex-shrink-0" />
              {kw}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ClusterTreeView({ clusters }: ClusterTreeViewProps) {
  if (clusters.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12 border rounded-md">
        No topic clusters yet. Run clustering from the strategy page.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground mb-3">
        {clusters.length} clusters ·{" "}
        {clusters.reduce((sum, c) => sum + c.keywords.length, 0)} total keywords
      </div>
      {clusters.map((cluster, i) => (
        <ClusterNode key={`${cluster.pillarKeyword}-${i}`} cluster={cluster} />
      ))}
    </div>
  );
}
