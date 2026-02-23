"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface TrendPoint {
  date: string;
  voiceMatchScore: number | null;
  userApproval: boolean | null;
  editRatio: number | null;
}

interface Summary {
  avgVoiceMatchScore: number | null;
  approvalRate: number | null;
  avgEditRatio: number | null;
  totalBlogs: number;
}

type WindowDays = 7 | 30 | 90;

const WINDOW_LABELS: Record<WindowDays, string> = {
  7: "7d",
  30: "30d",
  90: "90d",
};

function fmt(val: number | null, suffix = ""): string {
  if (val === null) return "—";
  return `${Math.round(val)}${suffix}`;
}

export function ConfidenceTrend() {
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/confidence?windowDays=${windowDays}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTrend(data.trend ?? []);
        setSummary(data.summary ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load confidence data");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [windowDays]);

  // Normalize approval boolean to 0/100 for chart display
  const chartData = trend.map((p) => ({
    date: p.date,
    "Voice Match": p.voiceMatchScore,
    "Approval": p.userApproval === null ? null : p.userApproval ? 100 : 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold">Content Confidence Trend</h3>
        <Tabs value={String(windowDays)} onValueChange={(v) => setWindowDays(Number(v) as WindowDays)}>
          <TabsList className="h-8">
            {(Object.entries(WINDOW_LABELS) as [string, string][]).map(([days, label]) => (
              <TabsTrigger key={days} value={days} className="text-xs px-3 h-6">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Avg Voice Match
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-2xl font-bold">{fmt(summary.avgVoiceMatchScore, "%")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Approval Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-2xl font-bold">{fmt(summary.approvalRate, "%")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Total Posts
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-2xl font-bold">{summary.totalBlogs}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive text-center py-8">{error}</p>
      ) : trend.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No data yet. Generate some blog posts to see trends here.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" width={36} />
            <Tooltip
              formatter={(value: number | null, name: string) =>
                value === null ? ["—", name] : [`${Math.round(value)}%`, name]
              }
              labelFormatter={(label: string) => `Date: ${label}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="Voice Match"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="Approval"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              connectNulls
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
