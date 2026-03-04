"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, Hash } from "lucide-react";
import { KeywordExplorer } from "@/components/keywords/keyword-explorer";
import type { KeywordRow } from "@/components/keywords/keyword-table";
import { PaywallGate } from "@/components/billing/paywall-gate";

export default function KeywordsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;

    async function loadAllKeywords() {
      setIsLoading(true);
      setError(null);

      try {
        const allKeywords: KeywordRow[] = [];
        let cursor: string | null = null;
        const seenCursors = new Set<string>();

        do {
          const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
          const response = await fetch(`/api/keywords${query}`);
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error ?? "Failed to load keywords");
          }

          const data = (await response.json()) as {
            keywords?: KeywordRow[];
            nextCursor?: string | null;
          };
          allKeywords.push(...(data.keywords ?? []));

          const nextCursor =
            typeof data.nextCursor === "string" ? data.nextCursor : null;
          if (nextCursor && seenCursors.has(nextCursor)) {
            throw new Error("Failed to paginate keywords");
          }
          if (nextCursor) {
            seenCursors.add(nextCursor);
          }
          cursor = nextCursor;
        } while (cursor);

        const deduped = Array.from(
          new Map(allKeywords.map((keyword) => [keyword._id, keyword])).values()
        );

        if (!cancelled) {
          setKeywords(deduped);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load keywords",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAllKeywords();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <PaywallGate>
      <main className="container max-w-5xl py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Hash className="h-6 w-6" /> All Keywords
          </h1>
          <p className="text-muted-foreground">
            All discovered keywords across your strategies.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <KeywordExplorer keywords={keywords} />
        )}
      </main>
    </PaywallGate>
  );
}
