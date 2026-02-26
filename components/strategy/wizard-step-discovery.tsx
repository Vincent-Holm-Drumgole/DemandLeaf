"use client";

import { useEffect, useRef } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStrategyStore, WIZARD_STEP } from "@/store/strategy-store";

const INTENT_COLORS: Record<string, string> = {
  informational: "bg-blue-100 text-blue-800",
  commercial: "bg-purple-100 text-purple-800",
  transactional: "bg-green-100 text-green-800",
  navigational: "bg-gray-100 text-gray-800",
};

export function WizardStepDiscovery() {
  const { currentStrategyId, discoveredKeywords, isDiscovering, error, runDiscovery, setStep } =
    useStrategyStore();
  const triggeredStrategyIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      currentStrategyId &&
      discoveredKeywords.length === 0 &&
      !isDiscovering &&
      triggeredStrategyIdRef.current !== currentStrategyId
    ) {
      triggeredStrategyIdRef.current = currentStrategyId;
      runDiscovery(currentStrategyId);
    }
  }, [currentStrategyId, discoveredKeywords.length, isDiscovering, runDiscovery]);

  if (isDiscovering) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Discovering keywords from your seeds…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => currentStrategyId && runDiscovery(currentStrategyId)}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Discovered Keywords
        </CardTitle>
        <CardDescription>
          {discoveredKeywords.length} keywords found, ranked by opportunity score.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">KD</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discoveredKeywords
                .slice()
                .sort((a, b) => b.opportunityScore - a.opportunityScore)
                .map((kw) => (
                  <TableRow key={kw.keyword}>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell className="text-right">{kw.searchVolume.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-medium ${
                          kw.keywordDifficulty >= 70
                            ? "text-destructive"
                            : kw.keywordDifficulty >= 40
                              ? "text-yellow-600"
                              : "text-green-600"
                        }`}
                      >
                        {kw.keywordDifficulty}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          INTENT_COLORS[kw.searchIntent] ?? "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {kw.searchIntent}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Math.round(kw.opportunityScore).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              {discoveredKeywords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No keywords found. Try different seeds.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <Button
          className="w-full mt-4"
          onClick={() => setStep(WIZARD_STEP.CLUSTERS)}
          disabled={discoveredKeywords.length === 0}
        >
          Continue to Clustering
        </Button>
      </CardContent>
    </Card>
  );
}
