"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FileText } from "lucide-react";
import { ROISummaryCards } from "@/components/performance/roi-summary-cards";
import { DecayAlertCard } from "@/components/performance/decay-alert-card";
import { GoogleConnectBanner } from "@/components/performance/google-connect-banner";
import type { ROIData } from "@/types";
import { PaywallGate } from "@/components/billing/paywall-gate";

interface AlertData {
  id: string;
  blogId: string;
  blogTitle: string;
  alertType: string;
  severity: string;
  triggeredAt: number;
  status: string;
  deltaPercent: number;
  diagnosisCause: string | null;
}

export default function PerformancePage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const router = useRouter();
  const [roi, setRoi] = useState<ROIData | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [roiRes, alertsRes] = await Promise.all([
          fetch("/api/roi"),
          fetch("/api/decay-alerts"),
        ]);
        let hasError = false;
        if (roiRes.ok) setRoi(await roiRes.json());
        else { setError("Failed to load performance data"); hasError = true; }
        if (alertsRes.ok) setAlerts(await alertsRes.json());
        else if (!hasError) setError("Failed to load alerts");
      } catch {
        setError("Failed to load performance data");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!isSignedIn) return null;

  async function handleAcknowledge(alertId: string) {
    await fetch(`/api/decay-alerts/${alertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acknowledge" }),
    });
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId ? { ...a, status: "acknowledged" } : a
      )
    );
  }

  async function handleDiagnose(alertId: string) {
    const res = await fetch(`/api/decay-alerts/${alertId}/diagnose`, {
      method: "POST",
    });
    if (res.ok) {
      const diagnosis = await res.json();
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, diagnosisCause: diagnosis.cause, status: "acknowledged" }
            : a
        )
      );
    }
  }

  function handleRefresh(alertId: string, blogId: string) {
    router.push(`/performance/${blogId}?alert=${alertId}`);
  }

  const openAlerts = alerts.filter(
    (a) => a.status === "open" || a.status === "acknowledged"
  );

  return (
    <PaywallGate>
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">Performance</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/api/report", "_blank")}
            >
              <FileText className="mr-1 h-3.5 w-3.5" />
              Monthly Report
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-48 rounded-lg" />
            </div>
          ) : (
            <>
              {roi && !roi.available && (
                <GoogleConnectBanner
                  onConnect={() => router.push("/api/google-auth")}
                />
              )}

              <ROISummaryCards
                trafficValue={roi?.estimatedTrafficValue ?? null}
                totalGenerationCostCents={roi?.totalGenerationCostCents ?? 0}
                postsRanking={roi?.postsRanking ?? 0}
                avgPosition={roi?.avgPosition ?? null}
                googleConnected={roi?.available ?? false}
                onConnect={() => router.push("/api/google-auth")}
              />

              {openAlerts.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Decay Alerts</CardTitle>
                      <Badge variant="destructive" className="text-[10px]">
                        {openAlerts.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {openAlerts.slice(0, 10).map((alert) => (
                      <DecayAlertCard
                        key={alert.id}
                        alert={alert}
                        blogTitle={alert.blogTitle}
                        onAcknowledge={handleAcknowledge}
                        onDiagnose={handleDiagnose}
                        onRefresh={handleRefresh}
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
