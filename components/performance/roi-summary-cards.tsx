"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Target, BarChart3 } from "lucide-react";

interface ROISummaryCardsProps {
  trafficValue: number | null;
  totalGenerationCostCents: number;
  postsRanking: number;
  avgPosition: number | null;
  googleConnected: boolean;
  onConnect?: () => void;
}

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function ROISummaryCards({
  trafficValue,
  totalGenerationCostCents,
  postsRanking,
  avgPosition,
  googleConnected,
  onConnect,
}: ROISummaryCardsProps) {
  const costSavings =
    trafficValue !== null
      ? Math.max(0, trafficValue - totalGenerationCostCents / 100)
      : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <DollarSign className="h-3.5 w-3.5" />
            Traffic Value
          </div>
          {trafficValue !== null ? (
            <p className="text-xl font-bold">{formatUsd(trafficValue)}</p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">—</p>
              {!googleConnected && onConnect && (
                <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={onConnect}>
                  Connect Google
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Cost Savings
          </div>
          {costSavings !== null ? (
            <p className="text-xl font-bold text-green-600">
              {formatUsd(costSavings)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Target className="h-3.5 w-3.5" />
            Posts Ranking
          </div>
          <p className="text-xl font-bold">{postsRanking}</p>
          <p className="text-[10px] text-muted-foreground">in top 20</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <BarChart3 className="h-3.5 w-3.5" />
            Avg Position
          </div>
          <p className="text-xl font-bold">
            {avgPosition !== null ? avgPosition : "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
