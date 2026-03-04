"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, RefreshCw, Plus } from "lucide-react";

interface WpConnection {
  id: string;
  siteUrl: string;
  pluginDetected: string | null;
  status: string;
  lastTestedAt: number | null;
}

export function WordPressSettings() {
  const [connections, setConnections] = useState<WpConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadConnections() {
    setLoading(true);
    try {
      const res = await fetch("/api/wp-connections");
      if (res.ok) setConnections(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConnections();
  }, []);

  async function handleAdd() {
    if (!siteUrl || !username || !appPassword) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/wp-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl, username, appPassword }),
      });
      if (res.ok || res.status === 502) {
        setSiteUrl("");
        setUsername("");
        setAppPassword("");
        setShowForm(false);
        await loadConnections();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to add connection");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      await fetch(`/api/wp-connections/${id}/test`, { method: "POST" });
      await loadConnections();
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this WordPress connection?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/wp-connections/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to remove connection");
        return;
      }
      await loadConnections();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading connections...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && !showForm && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      {connections.length === 0 && !showForm && !error && (
        <p className="text-sm text-muted-foreground">
          No WordPress sites connected yet.
        </p>
      )}

      {connections.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between rounded-md border p-3"
        >
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {c.siteUrl.replace(/^https?:\/\//, "")}
            </p>
            <div className="flex items-center gap-2">
              <Badge
                variant={c.status === "connected" ? "secondary" : "destructive"}
                className="text-[10px]"
              >
                {c.status}
              </Badge>
              {c.pluginDetected && c.pluginDetected !== "none" && (
                <Badge variant="outline" className="text-[10px]">
                  {c.pluginDetected === "rankmath" ? "Rank Math" : "Yoast SEO"}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => handleTest(c.id)}
              disabled={testingId === c.id}
            >
              {testingId === c.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-red-500"
              onClick={() => handleDelete(c.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="space-y-3 rounded-md border p-3">
          <Input
            placeholder="https://example.com"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
          />
          <Input
            placeholder="WordPress username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Application Password"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
          />
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Connect
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add WordPress Site
        </Button>
      )}
    </div>
  );
}
