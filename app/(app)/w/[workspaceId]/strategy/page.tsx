"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, TrendingUp, Copy, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StrategyWizard } from "@/components/strategy/strategy-wizard";
import { useStrategyStore } from "@/store/strategy-store";
import { PaywallGate } from "@/components/billing/paywall-gate";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";
import { useAuthGuard } from "@/hooks/use-auth-guard";

interface Strategy {
  _id: string;
  name: string;
  businessOutcomes: string;
  status: string;
  seedKeywords: string[];
  createdAt: number;
}

export default function StrategyPage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { reset } = useStrategyStore();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const controller = new AbortController();
    fetch("/api/strategy", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load strategies");
        }
        return response.json();
      })
      .then((data) => setStrategies(data.strategies ?? []))
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error(err);
        setLoadError("Failed to load strategies. Please try again.");
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [isLoaded, isSignedIn, fetchKey]);

  const handleOpenWizard = () => {
    reset();
    setShowWizard(true);
  };

  const handleWizardComplete = (strategyId: string) => {
    setShowWizard(false);
    if (!currentWorkspace?._id) return;
    router.push(buildWorkspacePath(currentWorkspace._id, `/strategy/${strategyId}`));
  };

  const handleDelete = async (e: React.MouseEvent, strategyId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this strategy and all its keywords, clusters, briefs, and calendar items? This cannot be undone.")) return;
    setBusyId(strategyId);
    try {
      const res = await fetch(`/api/strategy/${strategyId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete");
      }
      setStrategies((prev) => prev.filter((s) => s._id !== strategyId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete strategy");
    } finally {
      setBusyId(null);
    }
  };

  const handleClone = async (e: React.MouseEvent, strategyId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setBusyId(strategyId);
    try {
      const res = await fetch("/api/strategy/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to clone");
      }
      const data = await res.json();
      if (currentWorkspace?._id) {
        router.push(buildWorkspacePath(currentWorkspace._id, `/strategy/${data.strategyId}`));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to clone strategy");
    } finally {
      setBusyId(null);
    }
  };

  const handleRediscover = async (e: React.MouseEvent, strategyId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Re-run keyword discovery? This will clear existing keywords, clusters, briefs, and calendar items.")) return;
    setBusyId(strategyId);
    try {
      const res = await fetch(`/api/strategy/${strategyId}/rediscover`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to re-discover");
      }
      if (currentWorkspace?._id) {
        router.push(buildWorkspacePath(currentWorkspace._id, `/strategy/${strategyId}`));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to re-run discovery");
    } finally {
      setBusyId(null);
    }
  };

  if (!isLoaded || !isSignedIn) return null;

  return (
    <PaywallGate>
      <main className="container max-w-5xl py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6" /> Content Strategies
            </h1>
            <p className="text-muted-foreground">Keyword-driven content plans for your workspace.</p>
          </div>
          <Button onClick={handleOpenWizard}>
            <Plus className="h-4 w-4 mr-1" /> New Strategy
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <p className="text-destructive">{loadError}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setIsLoading(true);
                  setLoadError(null);
                  setFetchKey((k) => k + 1);
                }}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : strategies.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <TrendingUp className="h-12 w-12 text-muted-foreground/30" />
              <div className="text-center">
                <p className="font-medium">No strategies yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first strategy to discover keywords and plan your content.
                </p>
              </div>
              <Button onClick={handleOpenWizard}>
                <Plus className="h-4 w-4 mr-1" /> Create Strategy
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {strategies.map((strategy) => (
              <Link
                key={strategy._id}
                href={buildWorkspacePath(currentWorkspace._id, `/strategy/${strategy._id}`)}
              >
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{strategy.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Clone strategy"
                          disabled={busyId === strategy._id}
                          onClick={(e) => handleClone(e, strategy._id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Re-run keyword discovery"
                          disabled={busyId === strategy._id}
                          onClick={(e) => handleRediscover(e, strategy._id)}
                        >
                          {busyId === strategy._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Delete strategy"
                          disabled={busyId === strategy._id}
                          onClick={(e) => handleDelete(e, strategy._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Badge variant={strategy.status === "active" ? "default" : "secondary"}>
                          {strategy.status}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {strategy.businessOutcomes}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {strategy.seedKeywords.slice(0, 5).map((kw, i) => (
                        <Badge key={`${kw}-${i}`} variant="outline" className="text-xs">{kw}</Badge>
                      ))}
                      {strategy.seedKeywords.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{strategy.seedKeywords.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <Dialog open={showWizard} onOpenChange={setShowWizard}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Strategy</DialogTitle>
            </DialogHeader>
            <StrategyWizard onComplete={handleWizardComplete} />
          </DialogContent>
        </Dialog>
      </main>
    </PaywallGate>
  );
}
