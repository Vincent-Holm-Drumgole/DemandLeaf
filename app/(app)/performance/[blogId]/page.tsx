"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { DecayAlertCard } from "@/components/performance/decay-alert-card";
import { GoogleConnectBanner } from "@/components/performance/google-connect-banner";
import { PaywallGate } from "@/components/billing/paywall-gate";

interface Snapshot {
  id: string;
  keyword: string;
  position: number | null;
  checkedAt: number;
}

interface Metric {
  id: string;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  sessions: number | null;
  avgPosition: number | null;
  periodStart: number;
}

interface Alert {
  id: string;
  blogId: string;
  alertType: string;
  severity: string;
  triggeredAt: number;
  status: string;
  deltaPercent: number;
  diagnosisCause: string | null;
}

export default function BlogPerformancePage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const params = useParams();
  const router = useRouter();
  const blogId = typeof params.blogId === "string" ? params.blogId : "";

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [googleConnected, setGoogleConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [snapRes, perfRes] = await Promise.all([
          fetch(`/api/rank-snapshots/${blogId}`),
          fetch(`/api/performance/${blogId}`),
        ]);
        if (snapRes.ok) {
          const data = await snapRes.json();
          setSnapshots(data.snapshots);
        }
        if (perfRes.ok) {
          const data = await perfRes.json();
          setMetrics(data.metrics);
          setAlerts(data.alerts);
          setGoogleConnected(data.googleConnected);
        }
        if (!snapRes.ok && !perfRes.ok) {
          setError("Failed to load performance data");
        }
      } catch {
        setError("Network error loading performance data");
      } finally {
        setLoading(false);
      }
    }
    if (blogId) void load();
  }, [blogId]);

  async function handleCheckNow() {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/rank-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blogId }),
      });
      if (res.ok) {
        const result = await res.json();
        setSnapshots((prev) => [
          {
            id: `new-${Date.now()}`,
            keyword: result.keyword,
            position: result.position,
            checkedAt: result.checkedAt,
          },
          ...prev,
        ]);
      } else {
        setError("Rank check failed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!isSignedIn) return null;

  const latestPosition = snapshots[0]?.position ?? null;

  return (
    <PaywallGate>
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => router.push("/performance")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold">Blog Performance</h1>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCheckNow}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              Check Rank Now
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </div>
          ) : (
            <>
              {!googleConnected && (
                <GoogleConnectBanner
                  onConnect={() => router.push("/api/google-auth")}
                />
              )}

            {/* Rank History */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Rank History</CardTitle>
                  {latestPosition !== null && (
                    <Badge variant="secondary">Position {latestPosition}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {snapshots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No rank data yet. Click &quot;Check Rank Now&quot; to start tracking.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {snapshots.slice(0, 12).map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between text-xs py-1 border-b last:border-0"
                      >
                        <span className="text-muted-foreground">
                          {new Date(s.checkedAt).toLocaleDateString()}
                        </span>
                        <span className="font-medium">
                          {s.position !== null
                            ? `#${s.position}`
                            : "Not ranking"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* GA4/GSC Metrics */}
            {metrics.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Traffic Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Clicks</p>
                      <p className="text-lg font-bold">
                        {metrics.reduce((s, m) => s + (m.clicks ?? 0), 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Impressions
                      </p>
                      <p className="text-lg font-bold">
                        {metrics
                          .reduce((s, m) => s + (m.impressions ?? 0), 0)
                          .toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sessions</p>
                      <p className="text-lg font-bold">
                        {metrics.reduce((s, m) => s + (m.sessions ?? 0), 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg CTR</p>
                      <p className="text-lg font-bold">
                        {(
                          (metrics.reduce((s, m) => s + (m.ctr ?? 0), 0) /
                            Math.max(1, metrics.filter((m) => m.ctr != null).length)) *
                          100
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Decay Alerts */}
            {alerts.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Alerts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {alerts.map((alert) => (
                    <DecayAlertCard
                      key={alert.id}
                      alert={alert}
                      blogTitle="This post"
                    />
                  ))}
                </CardContent>
              </Card>
            )}
            </>
          )}
        </div>
      </div>
    </PaywallGate>
  );
}
