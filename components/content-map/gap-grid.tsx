"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { GapResult } from "@/types/content-map";

const GAP_ICONS: Record<string, string> = {
  cluster: "🗂",
  funnel: "🔻",
  intent: "🎯",
  archetype: "📝",
  freshness: "📅",
  aeo: "💬",
  cannibalization: "⚠️",
};

function severityVariant(s: GapResult["severity"]) {
  if (s === "high") return "destructive" as const;
  if (s === "medium") return "secondary" as const;
  return "outline" as const;
}

function severityLabel(s: GapResult["severity"]) {
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  return "Low";
}

function GapCard({ gap }: { gap: GapResult }) {
  const [open, setOpen] = useState(gap.severity !== "low");

  return (
    <Card
      className="cursor-pointer select-none"
      onClick={() => setOpen((v) => !v)}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{GAP_ICONS[gap.type]}</span>
          <CardTitle className="text-sm truncate">{gap.title}</CardTitle>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={severityVariant(gap.severity)} className="text-[10px]">
            {severityLabel(gap.severity)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {gap.count}/{gap.total}
          </span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {open && (
        <CardContent className="pt-0 space-y-2">
          <p className="text-xs text-muted-foreground">{gap.description}</p>
          <Progress value={gap.percentage} className="h-1.5" />
          {gap.items.length > 0 && (
            <ul className="space-y-0.5">
              {gap.items.slice(0, 3).map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground truncate">
                  • {item}
                </li>
              ))}
              {gap.items.length > 3 && (
                <li className="text-[10px] text-muted-foreground/70">
                  +{gap.items.length - 3} more
                </li>
              )}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface GapGridProps {
  gaps: GapResult[];
}

export function GapGrid({ gaps }: GapGridProps) {
  if (gaps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No gap data available yet. Add keywords and generate content to see
        analysis.
      </p>
    );
  }

  // Sort high → medium → low
  const sorted = [...gaps].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sorted.map((gap) => (
        <GapCard key={gap.type} gap={gap} />
      ))}
    </div>
  );
}
