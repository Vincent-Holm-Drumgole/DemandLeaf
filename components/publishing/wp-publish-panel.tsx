"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink, Download, Copy, Check } from "lucide-react";

interface WpConnection {
  id: string;
  siteUrl: string;
  pluginDetected: string | null;
  status: string;
}

interface AuthorPersona {
  id: string;
  name: string;
  isDefault: boolean;
}

interface WpPublishPanelProps {
  blogId: string;
  wpPostUrl?: string | null;
  connections: WpConnection[];
  personas: AuthorPersona[];
}

export function WpPublishPanel({
  blogId,
  wpPostUrl,
  connections,
  personas,
}: WpPublishPanelProps) {
  const [connectionId, setConnectionId] = useState(
    connections.find((c) => c.status === "connected")?.id ?? ""
  );
  const [personaId, setPersonaId] = useState(
    personas.find((p) => p.isDefault)?.id ?? ""
  );
  const [publishStatus, setPublishStatus] = useState<
    "draft" | "publish" | "future"
  >("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    wpPostUrl?: string;
    error?: string;
    blockers?: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handlePublish() {
    if (!connectionId) return;
    setPublishing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/blog/${blogId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wpConnectionId: connectionId,
          status: publishStatus,
          ...(publishStatus === "future" && scheduledAt
            ? { scheduledAt: new Date(scheduledAt).getTime() }
            : {}),
          authorPersonaId: personaId || undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: "Network error" });
    } finally {
      setPublishing(false);
    }
  }

  async function handleCopyHtml() {
    try {
      const res = await fetch(`/api/export/${blogId}?format=html`);
      if (res.ok) {
        const data = await res.json();
        await navigator.clipboard.writeText(data.html ?? data.content ?? "");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // silent
    }
  }

  // Already published state
  if (wpPostUrl) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">WordPress</CardTitle>
            <Badge variant="secondary" className="text-[10px] text-green-600">
              Published
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <a
            href={wpPostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View on WordPress
          </a>
        </CardContent>
      </Card>
    );
  }

  const connectedSites = connections.filter((c) => c.status === "connected");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Publish to WordPress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {connectedSites.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No WordPress sites connected. Add one in Settings → WordPress.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Site</label>
              <Select value={connectionId} onValueChange={setConnectionId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {connectedSites.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.siteUrl.replace(/^https?:\/\//, "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {personas.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Author</label>
                <Select value={personaId} onValueChange={setPersonaId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select author" />
                  </SelectTrigger>
                  <SelectContent>
                    {personas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.isDefault ? " (default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select
                value={publishStatus}
                onValueChange={(v) =>
                  setPublishStatus(v as "draft" | "publish" | "future")
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Save as Draft</SelectItem>
                  <SelectItem value="publish">Publish Now</SelectItem>
                  <SelectItem value="future">Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {publishStatus === "future" && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Schedule Date & Time
                </label>
                <Input
                  type="datetime-local"
                  className="h-8 text-xs"
                  value={scheduledAt}
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16)}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            )}

            <Button
              size="sm"
              className="w-full"
              onClick={handlePublish}
              disabled={
                publishing ||
                !connectionId ||
                (publishStatus === "future" && !scheduledAt)
              }
            >
              {publishing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {publishStatus === "draft"
                ? "Create Draft"
                : publishStatus === "publish"
                  ? "Publish Now"
                  : "Schedule"}
            </Button>

            {result && !result.success && (
              <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-2">
                <p className="text-xs text-red-700">
                  {result.error ?? "Publishing failed"}
                </p>
                {result.blockers && result.blockers.length > 0 && (
                  <ul className="list-disc pl-4 text-xs text-red-700">
                    {result.blockers.map((blocker, idx) => (
                      <li key={idx}>{blocker}</li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    asChild
                  >
                    <a href={`/api/export/${blogId}?format=html`} download>
                      <Download className="mr-1 h-3 w-3" />
                      Download HTML
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={handleCopyHtml}
                  >
                    {copied ? (
                      <Check className="mr-1 h-3 w-3" />
                    ) : (
                      <Copy className="mr-1 h-3 w-3" />
                    )}
                    Copy HTML
                  </Button>
                </div>
              </div>
            )}

            {result?.success && result.wpPostUrl && (
              <a
                href={result.wpPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-green-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View on WordPress
              </a>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
