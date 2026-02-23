"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Plus, Loader2 } from "lucide-react";

interface NeverSayItem {
  _id: string;
  term: string;
  termType: "word" | "phrase";
}

const MAX_TERMS = 100;

export function NeverSayList() {
  const [items, setItems] = useState<NeverSayItem[]>([]);
  const [newTerm, setNewTerm] = useState("");
  const [termType, setTermType] = useState<"word" | "phrase">("word");
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchTerms = useCallback(async () => {
    try {
      const res = await fetch("/api/never-say");
      if (!res.ok) throw new Error("Failed to load never-say list");
      const data = await res.json();
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  async function handleAdd() {
    const trimmed = newTerm.trim();
    if (!trimmed) return;
    if (trimmed.length > 50) {
      setError("Term must be 50 characters or fewer");
      return;
    }
    if (items.length >= MAX_TERMS) {
      setError(`Maximum ${MAX_TERMS} terms reached`);
      return;
    }

    setIsAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/never-say", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: trimmed, termType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add term");
      setItems((prev) => [...prev, data.item]);
      setNewTerm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add term");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    setItems((prev) => prev.filter((i) => i._id !== id));
    try {
      const res = await fetch(`/api/never-say/${id}`, { method: "DELETE" });
      if (!res.ok) {
        await fetchTerms();
        setError("Failed to delete term");
      }
    } catch {
      await fetchTerms();
      setError("Failed to delete term");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  const words = items.filter((i) => i.termType === "word");
  const phrases = items.filter((i) => i.termType === "phrase");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Terms and phrases the AI will never use in generated content.
        </p>
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.length}/{MAX_TERMS}
        </span>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <div className="flex rounded-md border overflow-hidden flex-shrink-0">
          <button
            type="button"
            onClick={() => setTermType("word")}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              termType === "word"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            Word
          </button>
          <button
            type="button"
            onClick={() => setTermType("phrase")}
            className={`px-3 py-2 text-xs font-medium border-l transition-colors ${
              termType === "phrase"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
          >
            Phrase
          </button>
        </div>

        <Input
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={termType === "word" ? "e.g. synergy" : "e.g. move the needle"}
          maxLength={50}
          className="flex-1"
          disabled={isAdding || items.length >= MAX_TERMS}
        />

        <Button
          onClick={handleAdd}
          disabled={isAdding || !newTerm.trim() || items.length >= MAX_TERMS}
          size="icon"
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No banned terms yet. Add words or phrases you never want to see in your content.
        </p>
      ) : (
        <div className="space-y-3">
          {words.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Words ({words.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {words.map((item) => (
                  <Badge
                    key={item._id}
                    variant="secondary"
                    className="pl-2.5 pr-1.5 py-1 gap-1 text-sm"
                  >
                    {item.term}
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id)}
                      disabled={deletingIds.has(item._id)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                      aria-label={`Remove "${item.term}"`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {phrases.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Phrases ({phrases.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {phrases.map((item) => (
                  <Badge
                    key={item._id}
                    variant="outline"
                    className="pl-2.5 pr-1.5 py-1 gap-1 text-sm"
                  >
                    {item.term}
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id)}
                      disabled={deletingIds.has(item._id)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                      aria-label={`Remove "${item.term}"`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
