"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KBEntryCard } from "./kb-entry-card";
import { KBEntryForm } from "./kb-entry-form";
import { KBImportDialog } from "./kb-import-dialog";
import { KBVersionDialog } from "./kb-version-dialog";
import type { KBEntry, KBEntryType } from "@/types";
import { apiFetch } from "@/lib/api-fetch";

const ENTRY_TYPE_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "company_info", label: "Company" },
  { value: "product", label: "Products" },
  { value: "customer_story", label: "Stories" },
  { value: "thought_leadership_position", label: "POV" },
  { value: "proprietary_data", label: "Data" },
];

export function KBList() {
  const { currentWorkspace } = useWorkspace();
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KBEntry | null>(null);
  const [historyEntry, setHistoryEntry] = useState<KBEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [isVerifyingVisible, setIsVerifyingVisible] = useState(false);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = activeTab !== "all" ? `/api/knowledge-base?type=${activeTab}` : "/api/knowledge-base";
      const res = await apiFetch(url, {
        headers: { "x-workspace-id": currentWorkspace._id },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEntries(data.entries);
      setError(null);
    } catch {
      setError("Failed to load knowledge base entries");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, currentWorkspace._id]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  async function handleSave(data: {
    entryType: KBEntryType;
    title: string;
    content: string;
    tags: string[];
    capabilityStatus: "current" | "planned";
    discoveryNotes?: string;
    lastVerifiedAt?: number;
    claims: Array<{
      statement: string;
      sourceName: string;
      sourceUrl?: string;
      confidence: "verified" | "observed" | "directional";
      lastCheckedAt: number;
      notes?: string;
    }>;
  }) {
    try {
      if (editingEntry) {
        const res = await apiFetch(`/api/knowledge-base/${editingEntry.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": currentWorkspace._id,
          },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Failed to update entry");
        }
      } else {
        const res = await apiFetch("/api/knowledge-base", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-workspace-id": currentWorkspace._id,
          },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Failed to create entry");
        }
      }
      setFormOpen(false);
      setEditingEntry(null);
      setError(null);
      void fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    const res = await apiFetch(`/api/knowledge-base/${id}`, {
      method: "DELETE",
      headers: { "x-workspace-id": currentWorkspace._id },
    });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setError(null);
    } else {
      setError("Failed to delete entry");
    }
  }

  async function handleRetryFailed() {
    if (isRetryingFailed) return;
    setIsRetryingFailed(true);
    setError(null);

    try {
      const res = await apiFetch("/api/knowledge-base/reindex", {
        method: "POST",
        headers: { "x-workspace-id": currentWorkspace._id },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to queue reindex");
      }
      void fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue reindex");
    } finally {
      setIsRetryingFailed(false);
    }
  }

  async function handleVerifyVisible() {
    if (isVerifyingVisible || entries.length === 0) return;
    setIsVerifyingVisible(true);
    setError(null);
    try {
      const res = await apiFetch("/api/knowledge-base/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": currentWorkspace._id,
        },
        body: JSON.stringify({ entryIds: entries.map((entry) => entry.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to verify entries");
      }
      void fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify entries");
    } finally {
      setIsVerifyingVisible(false);
    }
  }

  const failedEntriesCount = entries.filter((entry) => entry.embeddingStatus === "failed").length;
  const staleEntriesCount = entries.filter((entry) => {
    const verifiedAt = entry.lastVerifiedAt ?? entry.updatedAt;
    return Date.now() - verifiedAt > 90 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {entries.length} entries
          {staleEntriesCount > 0 ? ` • ${staleEntriesCount} due for review` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {entries.length > 0 && (
            <Button variant="outline" onClick={handleVerifyVisible} disabled={isVerifyingVisible}>
              {isVerifyingVisible ? "Marking…" : "Mark Visible as Verified"}
            </Button>
          )}
          {failedEntriesCount > 0 && (
            <Button variant="outline" onClick={handleRetryFailed} disabled={isRetryingFailed}>
              {isRetryingFailed
                ? "Retrying…"
                : `Retry Failed Indexes (${failedEntriesCount})`}
            </Button>
          )}
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Upload Document
          </Button>
          <Button onClick={() => { setEditingEntry(null); setFormOpen(true); }}>
            Add Entry
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          {ENTRY_TYPE_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {ENTRY_TYPE_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
            ) : entries.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p className="text-sm">No entries yet.</p>
                <Button
                  variant="link"
                  className="mt-1"
                  onClick={() => { setEditingEntry(null); setFormOpen(true); }}
                >
                  Add your first entry
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {entries.map((entry) => (
                  <KBEntryCard
                    key={entry.id}
                    entry={entry}
                    onEdit={(e) => { setEditingEntry(e); setFormOpen(true); }}
                    onDelete={handleDelete}
                    onViewHistory={(e) => setHistoryEntry(e)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <KBEntryForm
        open={formOpen}
        entry={editingEntry}
        onClose={() => { setFormOpen(false); setEditingEntry(null); }}
        onSave={handleSave}
      />

      <KBImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setError(null);
          void fetchEntries();
        }}
      />

      <KBVersionDialog
        entry={historyEntry}
        open={historyEntry !== null}
        onClose={() => setHistoryEntry(null)}
      />
    </div>
  );
}
