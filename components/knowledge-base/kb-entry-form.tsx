"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KBClaim, KBEntry, KBEntryType } from "@/types";
import { MAX_KB_CONTENT_CHARS } from "@/lib/knowledge-base/constants";
import { draftKnowledgeBaseClaims } from "@/lib/knowledge-base/claims";

const KB_ENTRY_TYPES: Array<{ value: KBEntryType; label: string }> = [
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

interface KBEntryFormProps {
  open: boolean;
  entry?: KBEntry | null;
  onClose: () => void;
  onSave: (data: {
    entryType: KBEntryType;
    title: string;
    content: string;
    tags: string[];
    capabilityStatus: "current" | "planned";
    discoveryNotes?: string;
    lastVerifiedAt?: number;
    claims: Array<
      Pick<KBClaim, "statement" | "sourceName" | "sourceUrl" | "confidence" | "lastCheckedAt" | "notes">
    >;
  }) => Promise<void>;
}

interface EditableClaim {
  statement: string;
  sourceName: string;
  sourceUrl?: string;
  confidence: "verified" | "observed" | "directional";
  lastCheckedAt: string;
  notes?: string;
}

function toDateInputValue(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function KBEntryForm({ open, entry, onClose, onSave }: KBEntryFormProps) {
  const [entryType, setEntryType] = useState<KBEntryType>(entry?.entryType ?? "company_info");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [tagInput, setTagInput] = useState(entry?.tags.join(", ") ?? "");
  const [capabilityStatus, setCapabilityStatus] = useState<"current" | "planned">(
    entry?.capabilityStatus ?? "current",
  );
  const [discoveryNotes, setDiscoveryNotes] = useState(entry?.discoveryNotes ?? "");
  const [lastVerifiedAt, setLastVerifiedAt] = useState(toDateInputValue(entry?.lastVerifiedAt));
  const [claims, setClaims] = useState<EditableClaim[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEntryType(entry?.entryType ?? "company_info");
      setTitle(entry?.title ?? "");
      setContent(entry?.content ?? "");
      setTagInput(entry?.tags?.join(", ") ?? "");
      setCapabilityStatus(entry?.capabilityStatus ?? "current");
      setDiscoveryNotes(entry?.discoveryNotes ?? "");
      setLastVerifiedAt(toDateInputValue(entry?.lastVerifiedAt));
      setClaims(
        (entry?.claims ?? []).map((claim) => ({
          statement: claim.statement,
          sourceName: claim.sourceName,
          sourceUrl: claim.sourceUrl,
          confidence: claim.confidence,
          lastCheckedAt: toDateInputValue(claim.lastCheckedAt),
          notes: claim.notes,
        })),
      );
      setError(null);
    }
  }, [open, entry]);

  const tags = tagInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required");
      return;
    }
    if (content.length > MAX_KB_CONTENT_CHARS) {
      setError(`Content must be ${MAX_KB_CONTENT_CHARS} characters or less`);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave({
        entryType,
        title: title.trim(),
        content: content.trim(),
        tags,
        capabilityStatus,
        discoveryNotes: discoveryNotes.trim() || undefined,
        lastVerifiedAt: lastVerifiedAt ? new Date(lastVerifiedAt).getTime() : undefined,
        claims: claims
          .filter((claim) => claim.statement.trim().length > 0 && claim.sourceName.trim().length > 0)
          .map((claim) => ({
            statement: claim.statement.trim(),
            sourceName: claim.sourceName.trim(),
            sourceUrl: claim.sourceUrl?.trim() || undefined,
            confidence: claim.confidence,
            lastCheckedAt: claim.lastCheckedAt ? new Date(claim.lastCheckedAt).getTime() : Date.now(),
            notes: claim.notes?.trim() || undefined,
          })),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Entry" : "Add Knowledge Base Entry"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="grid gap-4 md:grid-cols-[1fr_220px_220px]">
            <div className="space-y-1.5">
              <Label htmlFor="entryType">Entry Type</Label>
              <Select
                value={entryType}
                onValueChange={(v) => setEntryType(v as KBEntryType)}
              >
                <SelectTrigger id="entryType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KB_ENTRY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="capabilityStatus">Capability Status</Label>
              <Select
                value={capabilityStatus}
                onValueChange={(value) => setCapabilityStatus(value as "current" | "planned")}
              >
                <SelectTrigger id="capabilityStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lastVerifiedAt">Last Verified</Label>
              <Input
                id="lastVerifiedAt"
                type="date"
                value={lastVerifiedAt}
                onChange={(e) => setLastVerifiedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief descriptive title"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="discoveryNotes">Discovery Notes</Label>
            <Textarea
              id="discoveryNotes"
              value={discoveryNotes}
              onChange={(e) => setDiscoveryNotes(e.target.value)}
              placeholder="Paste buyer language, call notes, or nuance that should shape future content."
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Label htmlFor="content">Content</Label>
              <span className={`text-xs ${content.length > MAX_KB_CONTENT_CHARS ? "text-destructive" : "text-muted-foreground"}`}>
                {content.length}/{MAX_KB_CONTENT_CHARS}
              </span>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the knowledge base content here..."
              rows={12}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags (optional, comma-separated)</Label>
            <Input
              id="tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g. saas, automation, enterprise"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Source-Annotated Claims</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Add statistics or factual claims with a source and confidence level.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const drafted = draftKnowledgeBaseClaims(content);
                    setClaims(
                      drafted.map((claim) => ({
                        statement: claim.statement,
                        sourceName: claim.sourceName,
                        sourceUrl: claim.sourceUrl,
                        confidence: claim.confidence,
                        lastCheckedAt: toDateInputValue(claim.lastCheckedAt),
                        notes: claim.notes,
                      })),
                    );
                  }}
                >
                  Auto-Draft Claims
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setClaims((current) => [
                      ...current,
                      {
                        statement: "",
                        sourceName: "",
                        confidence: "verified",
                        lastCheckedAt: toDateInputValue(Date.now()),
                      },
                    ])
                  }
                >
                  Add Claim
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {claims.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No claims annotated yet.
                </div>
              ) : (
                claims.map((claim, index) => (
                  <div key={`${claim.statement}-${index}`} className="rounded-lg border p-3 space-y-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_220px_160px]">
                      <div className="space-y-1.5">
                        <Label>Statement</Label>
                        <Textarea
                          value={claim.statement}
                          onChange={(event) =>
                            setClaims((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, statement: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          rows={3}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Source Name</Label>
                        <Input
                          value={claim.sourceName}
                          onChange={(event) =>
                            setClaims((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, sourceName: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Confidence</Label>
                        <Select
                          value={claim.confidence}
                          onValueChange={(value) =>
                            setClaims((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      confidence: value as "verified" | "observed" | "directional",
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="verified">Verified</SelectItem>
                            <SelectItem value="observed">Observed</SelectItem>
                            <SelectItem value="directional">Directional</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                      <div className="space-y-1.5">
                        <Label>Source URL</Label>
                        <Input
                          value={claim.sourceUrl ?? ""}
                          onChange={(event) =>
                            setClaims((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, sourceUrl: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Last Checked</Label>
                        <Input
                          type="date"
                          value={claim.lastCheckedAt}
                          onChange={(event) =>
                            setClaims((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, lastCheckedAt: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setClaims((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Notes</Label>
                      <Input
                        value={claim.notes ?? ""}
                        onChange={(event) =>
                          setClaims((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, notes: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="Optional context for how to use or phrase this claim"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
