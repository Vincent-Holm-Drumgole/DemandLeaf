"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, CalendarDays } from "lucide-react";
import { ContentCalendar } from "@/components/calendar/content-calendar";

interface CalendarEntry {
  _id: string;
  strategyId: string;
  keyword: string;
  archetype: string;
  scheduledDate: number;
  priority: number;
  status: string;
  briefId?: string;
  keywordId: string;
}

export default function CalendarPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<CalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    fetch("/api/calendar")
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load calendar");
        }
        return response.json();
      })
      .then((data) => setItems(data.items ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load calendar"),
      )
      .finally(() => setIsLoading(false));
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
