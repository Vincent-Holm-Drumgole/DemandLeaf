"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StrategyWizard } from "@/components/strategy/strategy-wizard";
import { useStrategyStore } from "@/store/strategy-store";

interface Strategy {
  _id: string;
  name: string;
  businessOutcomes: string;
  status: string;
  seedKeywords: string[];
  createdAt: number;
}

export default function StrategyPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const { reset } = useStrategyStore();

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/strategy")
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load strategies");
        }
        return response.json();
      })
      .then((data) => setStrategies(data.strategies ?? []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [isLoaded, isSignedIn]);

  const handleOpenWizard = () => {
    reset();
    setShowWizard(true);
  };

  const handleWizardComplete = (strategyId: string) => {
    setShowWizard(false);
    router.push(`/strategy/${strategyId}`);
  };

  if (!isLoaded || !isSignedIn) return null;

  return (
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
            <Link key={strategy._id} href={`/strategy/${strategy._id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{strategy.name}</CardTitle>
                    <Badge variant={strategy.status === "active" ? "default" : "secondary"}>
                      {strategy.status}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {strategy.businessOutcomes}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {strategy.seedKeywords.slice(0, 5).map((kw) => (
                      <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>
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
  );
}
