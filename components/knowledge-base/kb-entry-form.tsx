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
import type { KBEntry, KBEntryType } from "@/types";

const KB_ENTRY_TYPES: { value: KBEntryType; label: string }[] = [
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

const MAX_CONTENT_CHARS = 2000;

interface KBEntryFormProps {
  open: boolean;
  entry?: KBEntry | null;
  onClose: () => void;
  onSave: (data: { entryType: KBEntryType; title: string; content: string; tags: string[] }) => Promise<void>;
}

export function KBEntryForm({ open, entry, onClose, onSave }: KBEntryFormProps) {
  const [entryType, setEntryType] = useState<KBEntryType>(entry?.entryType ?? "company_info");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [tagInput, setTagInput] = useState(entry?.tags.join(", ") ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEntryType(entry?.entryType ?? "company_info");
      setTitle(entry?.title ?? "");
      setContent(entry?.content ?? "");
      setTagInput(entry?.tags?.join(", ") ?? "");
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
    if (content.length > MAX_CONTENT_CHARS) {
      setError(`Content must be ${MAX_CONTENT_CHARS} characters or less`);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave({ entryType, title: title.trim(), content: content.trim(), tags });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Entry" : "Add Knowledge Base Entry"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex justify-between">
              <Label htmlFor="content">Content</Label>
              <span className={`text-xs ${content.length > MAX_CONTENT_CHARS ? "text-destructive" : "text-muted-foreground"}`}>
                {content.length}/{MAX_CONTENT_CHARS}
              </span>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the knowledge base content here..."
              rows={6}
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
