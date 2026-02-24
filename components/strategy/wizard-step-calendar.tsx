"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { useStrategyStore } from "@/store/strategy-store";

interface WizardStepCalendarProps {
  onComplete: () => void;
}

export function WizardStepCalendar({ onComplete }: WizardStepCalendarProps) {
  const { clusters, currentStrategyId } = useStrategyStore();
  const [postsPerMonth, setPostsPerMonth] = useState(4);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalKeywords = clusters.reduce((sum, c) => sum + c.keywords.length, 0);
  const monthsNeeded = totalKeywords > 0 ? Math.ceil(totalKeywords / postsPerMonth) : 0;

  const handleFinish = async () => {
    if (!currentStrategyId) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: currentStrategyId,
          postsPerMonth,
          startDate: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        let message = "Failed to generate calendar";
        try {
          const data = await response.json();
          message = data.error ?? message;
        } catch {
          // Non-JSON response
        }
        throw new Error(message);
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate calendar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Content Calendar
        </CardTitle>
        <CardDescription>
          Set your publishing cadence to generate a content calendar across {clusters.length} clusters.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Posts per month</Label>
            <span className="text-lg font-semibold">{postsPerMonth}</span>
          </div>
          <Slider
            min={1}
            max={20}
            step={1}
            value={[postsPerMonth]}
            onValueChange={([val]) => setPostsPerMonth(val)}
          />
          <div className="flex gap-1">
            {[2, 4, 8, 12].map((n) => (
              <Button
                key={n}
                variant={postsPerMonth === n ? "default" : "outline"}
                size="sm"
                onClick={() => setPostsPerMonth(n)}
              >
                {n}/mo
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-muted p-3">
            <div className="text-muted-foreground">Total Keywords</div>
            <div className="text-2xl font-bold">{totalKeywords}</div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="text-muted-foreground">Months to Complete</div>
            <div className="text-2xl font-bold">{monthsNeeded}</div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">Clusters included:</p>
          <div className="flex flex-wrap gap-1">
            {clusters.map((c, i) => (
              <Badge key={i} variant="secondary">{c.pillarKeyword}</Badge>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button className="w-full" onClick={handleFinish} disabled={clusters.length === 0 || isSaving}>
          Generate Calendar &amp; Finish
        </Button>
      </CardContent>
    </Card>
  );
}
