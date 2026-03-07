"use client";

import { useEffect, useMemo, useState } from "react";
import type { KBEntryType } from "@/types";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { apiFetch } from "@/lib/api-fetch";
import {
  type KnowledgeBaseImportDraft,
  parseKnowledgeBaseMarkdown,
} from "@/lib/knowledge-base/markdown-import";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ENTRY_TYPE_OPTIONS: Array<{ value: KBEntryType; label: string }> = [
  { value: "company_info", label: "Company Info" },
  { value: "product", label: "Product" },
  { value: "audience", label: "Audience" },
  { value: "competitor", label: "Competitor" },
  { value: "industry", label: "Industry" },
  { value: "customer_story", label: "Customer Story" },
  { value: "expert_insight", label: "Expert Insight" },
  { value: "proprietary_data", label: "Proprietary Data" },
  { value: "hot_take", label: "Hot Take" },
  { value: "lesson_learned", label: "Lesson Learned" },
  { value: "methodology", label: "Methodology" },
  { value: "thought_leadership_position", label: "Thought Leadership Position" },
];

interface KBImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function KBImportDialog({ open, onClose, onImported }: KBImportDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const [entries, setEntries] = useState<KnowledgeBaseImportDraft[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEntries([]);
      setFileName(null);
      setIsImporting(false);
      setError(null);
    }
  }, [open]);

  const includedCount = useMemo(
    () => entries.filter((entry) => entry.include).length,
    [entries],
  );

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsedEntries = parseKnowledgeBaseMarkdown(text);
      setEntries(parsedEntries);
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : "Failed to parse markdown file");
    }
  }

  function updateEntry(id: string, patch: Partial<KnowledgeBaseImportDraft>) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  async function handleImport() {
    if (isImporting) return;

    const selectedEntries = entries.filter((entry) => entry.include);
    if (selectedEntries.length === 0) {
      setError("Select at least one parsed section to import.");
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const res = await apiFetch("/api/knowledge-base/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": currentWorkspace._id,
        },
        body: JSON.stringify({
          entries: selectedEntries.map((entry) => ({
            entryType: entry.entryType,
            title: entry.title,
            content: entry.content,
            tags: entry.tags,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : "Import failed");
      }
      onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Upload Markdown Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kb-markdown-upload">Markdown file</Label>
            <Input
              id="kb-markdown-upload"
              type="file"
              accept=".md,text/markdown"
              onChange={handleFileSelected}
            />
            <p className="text-xs text-muted-foreground">
              Import uses H2 headings (`##`) as section boundaries. Oversized sections are
              automatically split at paragraph boundaries.
            </p>
          </div>

          {fileName && (
            <p className="text-sm text-muted-foreground">
              Parsed file: {fileName}
              {entries.length > 0 ? ` • ${entries.length} entries detected` : ""}
            </p>
          )}

          {entries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium">Import Preview</p>
                <p className="text-muted-foreground">{includedCount} selected</p>
              </div>

              <ScrollArea className="h-[420px] rounded-lg border">
                <div className="space-y-3 p-4">
                  {entries.map((entry) => (
                    <div key={entry.id} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={entry.include}
                            onCheckedChange={(checked) => updateEntry(entry.id, { include: checked })}
                          />
                          <span className="text-sm font-medium">Import section</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {entry.content.length} chars
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                        <div className="space-y-1.5">
                          <Label>Title</Label>
                          <Input
                            value={entry.title}
                            onChange={(event) =>
                              updateEntry(entry.id, { title: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Entry Type</Label>
                          <Select
                            value={entry.entryType}
                            onValueChange={(value) =>
                              updateEntry(entry.id, { entryType: value as KBEntryType })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ENTRY_TYPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Tags</Label>
                        <Input
                          value={entry.tags.join(", ")}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              tags: event.target.value
                                .split(",")
                                .map((tag) => tag.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Content Preview</Label>
                        <Textarea value={entry.content} readOnly rows={6} />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={entries.length === 0 || includedCount === 0 || isImporting}
          >
            {isImporting ? "Importing…" : `Import ${includedCount || ""} Entries`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
