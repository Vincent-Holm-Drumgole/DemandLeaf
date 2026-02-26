"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Opportunity } from "@/types/content-map";

function impactColor(score: number) {
  if (score >= 70) return "bg-green-100 text-green-800";
  if (score >= 40) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-700";
}

function effortBadgeVariant(effort: Opportunity["effort"]) {
  if (effort === "low") return "secondary" as const;
  if (effort === "medium") return "outline" as const;
  return "destructive" as const;
}

const PAGE_SIZE = 10;

interface OpportunityListProps {
  opportunities: Opportunity[];
}

export function OpportunityList({ opportunities }: OpportunityListProps) {
  const [showAll, setShowAll] = useState(false);

  if (opportunities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No opportunities yet. Generate a strategy and some blogs to see ranked
        suggestions here.
      </p>
    );
  }

  const visible = showAll ? opportunities : opportunities.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-2">
      {visible.map((opp) => (
        <div
          key={opp.id}
          className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3"
        >
          {/* Impact score badge */}
          <span
            className={[
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              impactColor(opp.impactScore),
            ].join(" ")}
          >
            {opp.impactScore}
          </span>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{opp.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {opp.description}
            </p>
          </div>

          {/* Effort + action */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={effortBadgeVariant(opp.effort)} className="text-[10px]">
              {opp.effort} effort
            </Badge>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link href={opp.actionHref}>{opp.actionLabel}</Link>
            </Button>
          </div>
        </div>
      ))}

      {opportunities.length > PAGE_SIZE && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1"
        >
          {showAll
            ? "Show less"
            : `Show ${opportunities.length - PAGE_SIZE} more`}
        </button>
      )}
    </div>
  );
}
