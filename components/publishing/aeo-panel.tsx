"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { AeoCheckResult } from "@/types";

interface AeoPanelProps {
  blogId: string;
  initialScore: number | null;
  initialChecks: AeoCheckResult[];
  onOptimized?: (newScore: number) => void;
}

export function AeoPanel({
  blogId,
  initialScore,
  initialChecks,
  onOptimized,
}: AeoPanelProps) {
  const [score, setScore] = useState(initialScore);
  const [checks, setChecks] = useState(initialChecks);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  async function handleScore() {
    setLoading(true);
    try {
      const res = await fetch(`/api/blog/${blogId}/aeo`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setScore(data.aeoScore.score);
        setChecks(data.aeoScore.checks);
        onOptimized?.(data.aeoScore.score);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOptimize() {
    setOptimizing(true);
    try {
      const res = await fetch(`/api/blog/${blogId}/aeo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optimize: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setScore(data.aeoScore.score);
        setChecks(data.aeoScore.checks);
        onOptimized?.(data.aeoScore.score);
      }
    } finally {
      setOptimizing(false);
    }
  }

  const scoreColor =
    score === null
      ? "text-muted-foreground"
      : score >= 60
        ? "text-green-600"
        : score >= 40
          ? "text-yellow-600"
          : "text-red-600";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">AEO Score</CardTitle>
          {score !== null && (
            <span className={`text-lg font-bold ${scoreColor}`}>{score}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {score === null ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleScore}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Score AEO Readiness
          </Button>
        ) : (
          <>
            <div className="space-y-1">
              {checks.map((check) => (
                <div
                  key={check.name}
                  className="flex items-start gap-1.5 text-xs"
                >
                  {check.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <span className={check.passed ? "text-muted-foreground" : ""}>
                    {check.name}
                  </span>
                </div>
              ))}
            </div>
            {score < 60 && (
              <Button
                size="sm"
                className="w-full"
                onClick={handleOptimize}
                disabled={optimizing}
              >
                {optimizing && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                Optimize for AEO
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={handleScore}
              disabled={loading}
            >
              Re-score
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
