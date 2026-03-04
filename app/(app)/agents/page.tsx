"use client";

import { useEffect, useState } from "react";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot } from "lucide-react";
import { AgentActionCard } from "@/components/agents/agent-action-card";
import type { AgentType, AgentActionStatus } from "@/types";
import { PaywallGate } from "@/components/billing/paywall-gate";

interface ActionData {
  id: string;
  agentType: AgentType;
  status: AgentActionStatus;
  payload: unknown;
  reasoning: string;
  suggestedAt: number;
  decidedAt: number | null;
  executedAt: number | null;
  userNote: string | null;
}

export default function AgentsPage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const [actions, setActions] = useState<ActionData[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadActions() {
    setLoading(true);
    try {
      const res = await fetch("/api/agent-actions");
      if (res.ok) setActions(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadActions();
  }, []);

  async function handleApprove(actionId: string) {
    const res = await fetch(`/api/agent-actions/${actionId}/approve`, {
      method: "POST",
    });
    if (res.ok) {
      setActions((prev) =>
        prev.map((a) =>
          a.id === actionId ? { ...a, status: "done" as const } : a
        )
      );
    }
  }

  async function handleReject(actionId: string, note?: string) {
    await fetch(`/api/agent-actions/${actionId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setActions((prev) =>
      prev.map((a) =>
        a.id === actionId
          ? { ...a, status: "rejected" as const, userNote: note ?? null }
          : a
      )
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!isSignedIn) return null;

  const calendarActions = actions.filter((a) => a.agentType === "calendar");
  const refreshActions = actions.filter((a) => a.agentType === "refresh");
  const linkActions = actions.filter((a) => a.agentType === "internal_links");
  const pendingCount = actions.filter((a) => a.status === "pending").length;

  return (
    <PaywallGate>
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">Agents</h1>
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : actions.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">
                No agent actions yet. Agents will propose actions based on your
                content performance.
              </p>
            </div>
          ) : (
            <Tabs defaultValue="all">
              <TabsList className="mb-4">
                <TabsTrigger value="all">
                  All ({actions.length})
                </TabsTrigger>
                <TabsTrigger value="calendar">
                  Calendar ({calendarActions.length})
                </TabsTrigger>
                <TabsTrigger value="refresh">
                  Refresh ({refreshActions.length})
                </TabsTrigger>
                <TabsTrigger value="links">
                  Links ({linkActions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-3">
                {actions.map((action) => (
                  <AgentActionCard
                    key={action.id}
                    action={action}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </TabsContent>

              <TabsContent value="calendar" className="space-y-3">
                {calendarActions.map((action) => (
                  <AgentActionCard
                    key={action.id}
                    action={action}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </TabsContent>

              <TabsContent value="refresh" className="space-y-3">
                {refreshActions.map((action) => (
                  <AgentActionCard
                    key={action.id}
                    action={action}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </TabsContent>

              <TabsContent value="links" className="space-y-3">
                {linkActions.map((action) => (
                  <AgentActionCard
                    key={action.id}
                    action={action}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </PaywallGate>
  );
}
