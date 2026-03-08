"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { apiFetch } from "@/lib/api-fetch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { KBEntry, KBVersion } from "@/types";

interface KBVersionDialogProps {
  entry: KBEntry | null;
  open: boolean;
  onClose: () => void;
}

export function KBVersionDialog({ entry, open, onClose }: KBVersionDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const [versions, setVersions] = useState<KBVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !entry) {
      setVersions([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await apiFetch(`/api/knowledge-base/${entry.id}/versions`, {
          headers: { "x-workspace-id": currentWorkspace._id },
        });
        if (!res.ok) {
          throw new Error("Failed to load version history");
        }
        const data = await res.json();
        if (!cancelled) {
          setVersions(data.versions ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load version history");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentWorkspace._id, entry, open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Version History{entry ? ` • ${entry.title}` : ""}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading version history…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions recorded yet.</p>
        ) : (
          <ScrollArea className="h-[520px] pr-3">
            <div className="space-y-3">
              {versions.map((version) => (
                <div key={version.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{version.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(version.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{version.capabilityStatus === "planned" ? "Planned" : "Current"}</p>
                      <p>
                        Verified{" "}
                        {version.lastVerifiedAt
                          ? new Date(version.lastVerifiedAt).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  </div>
                  {version.discoveryNotes && (
                    <p className="text-xs text-muted-foreground">
                      Notes: {version.discoveryNotes}
                    </p>
                  )}
                  <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-5">
                    {version.content}
                  </pre>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
