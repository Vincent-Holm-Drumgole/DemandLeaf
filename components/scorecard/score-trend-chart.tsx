"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TrendPoint {
  date: string;
  avgComposite: number;
  count: number;
}

interface ScoreTrendChartProps {
  trend: TrendPoint[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ScoreTrendChart({ trend }: ScoreTrendChartProps) {
  if (trend.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Score Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            Score more outputs to see trends.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Score Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <Tooltip
              formatter={(value: number | undefined) => [
                value != null ? value.toFixed(1) : "--",
                "Score",
              ]}
              labelFormatter={(label) => formatDate(String(label))}
            />
            <Line
              type="monotone"
              dataKey="avgComposite"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
