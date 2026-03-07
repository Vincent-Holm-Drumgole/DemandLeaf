"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { apiFetch } from "@/lib/api-fetch";
import { MAX_MASTER_CONTEXT_CHARS } from "@/lib/knowledge-base/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const SUGGESTED_SECTIONS = [
  "Company description: what you do and who you serve",
  "Brand voice: tone, writing principles, and words to avoid",
  "Key differentiators: what makes your company meaningfully different",
  "Target audience summary: who should see themselves in your content",
];

export function MasterContextCard() {
  const { currentWorkspace } = useWorkspace();
  const [value, setValue] = useState(currentWorkspace.masterContext ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(currentWorkspace.masterContext ?? "");
    setError(null);
    setSaved(false);
  }, [currentWorkspace._id, currentWorkspace.masterContext]);

  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await apiFetch("/api/workspaces/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": currentWorkspace._id,
        },
        body: JSON.stringify({
          masterContext: value.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "Failed to save master context",
        );
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save master context");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Master Context</CardTitle>
        <p className="text-sm text-muted-foreground">
          This workspace-level context is always included during blog generation, even when
          semantic search does not retrieve a matching knowledge base entry.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Suggested sections</p>
          <div className="mt-2 space-y-1 text-muted-foreground">
            {SUGGESTED_SECTIONS.map((section) => (
              <p key={section}>{section}</p>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Always-on brand context</p>
            <span
              className={`text-xs ${
                value.length > MAX_MASTER_CONTEXT_CHARS
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {value.length}/{MAX_MASTER_CONTEXT_CHARS}
            </span>
          </div>
          <Textarea
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSaved(false);
            }}
            placeholder={`Company description\n\nBrand voice\n\nKey differentiators\n\nTarget audience summary`}
            rows={12}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-green-600">Master context saved.</p>}

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || value.length > MAX_MASTER_CONTEXT_CHARS}
          >
            {isSaving ? "Saving…" : "Save Master Context"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
