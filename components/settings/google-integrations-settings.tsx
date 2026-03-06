"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Unlink } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspaceApiUrl } from "@/lib/workspace-paths";

interface GoogleConnection {
  connected: boolean;
  id?: string;
  ga4PropertyId?: string | null;
  gscSiteUrl?: string | null;
  status?: string;
  lastSyncedAt?: number | null;
}

export function GoogleIntegrationsSettings() {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [conn, setConn] = useState<GoogleConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadConnection() {
    setLoading(true);
    try {
      const res = await fetch("/api/google-connections");
      if (res.ok) setConn(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConnection();
  }, []);

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Google? Metrics syncing will stop.")) return;
    setError(null);
    try {
      const res = await fetch("/api/google-connections", { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to disconnect. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    await loadConnection();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!conn?.connected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Connect Google Analytics and Search Console to track traffic,
          clicks, impressions, and CTR for your published posts.
        </p>
        <Button
          onClick={() =>
            router.push(buildWorkspaceApiUrl("/api/google-auth", currentWorkspace._id))
          }
        >
          <Link2 className="mr-2 h-4 w-4" />
          Connect Google Account
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <div className="flex items-center justify-between rounded-md border p-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Google Account</p>
            <Badge
              variant={conn.status === "connected" ? "secondary" : "destructive"}
              className="text-[10px]"
            >
              {conn.status}
            </Badge>
          </div>
          {conn.ga4PropertyId && (
            <p className="text-xs text-muted-foreground">
              GA4: {conn.ga4PropertyId}
            </p>
          )}
          {conn.gscSiteUrl && (
            <p className="text-xs text-muted-foreground">
              GSC: {conn.gscSiteUrl}
            </p>
          )}
          {conn.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">
              Last synced:{" "}
              {new Date(conn.lastSyncedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-500"
          onClick={handleDisconnect}
        >
          <Unlink className="mr-1 h-3.5 w-3.5" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
