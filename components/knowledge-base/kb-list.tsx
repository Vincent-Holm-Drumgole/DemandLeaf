"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { KBEntryCard } from "./kb-entry-card";
import { KBEntryForm } from "./kb-entry-form";
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
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KBEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = activeTab !== "all" ? `/api/knowledge-base?type=${activeTab}` : "/api/knowledge-base";
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEntries(data.entries);
    } catch {
      setError("Failed to load knowledge base entries");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  async function handleSave(data: { entryType: KBEntryType; title: string; content: string; tags: string[] }) {
    try {
      if (editingEntry) {
        const res = await apiFetch(`/api/knowledge-base/${editingEntry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? "Failed to update entry");
        }
      } else {
        const res = await apiFetch("/api/knowledge-base", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    const res = await apiFetch(`/api/knowledge-base/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } else {
      setError("Failed to delete entry");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{entries.length} entries</p>
        <Button onClick={() => { setEditingEntry(null); setFormOpen(true); }}>
          Add Entry
        </Button>
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
    </div>
  );
}
