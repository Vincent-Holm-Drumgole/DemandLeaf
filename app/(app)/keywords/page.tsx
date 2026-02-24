"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, Hash } from "lucide-react";
import { KeywordExplorer } from "@/components/keywords/keyword-explorer";
import type { KeywordRow } from "@/components/keywords/keyword-table";

export default function KeywordsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    fetch("/api/keywords")
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load keywords");
        }
        return response.json();
      })
      .then((data) => setKeywords(data.keywords ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load keywords"),
      )
      .finally(() => setIsLoading(false));
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) return null;

  return (
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
  );
}
