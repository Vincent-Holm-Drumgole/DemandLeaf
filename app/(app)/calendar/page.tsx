"use client";

import { useEffect, useState } from "react";
import { Loader2, CalendarDays } from "lucide-react";
import { ContentCalendar } from "@/components/calendar/content-calendar";
import type { CalendarEntry } from "@/types/calendar";
import { useAuthGuard } from "@/hooks/use-auth-guard";

export default function CalendarPage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const [items, setItems] = useState<CalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const controller = new AbortController();

    fetch("/api/calendar", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load calendar");
        }
        return response.json();
      })
      .then((data) => setItems(data.items ?? []))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load calendar");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <main className="container max-w-5xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6" /> Content Calendar
        </h1>
        <p className="text-muted-foreground">
          Your scheduled content across all strategies.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : (
        <ContentCalendar items={items} />
      )}
    </main>
  );
}
