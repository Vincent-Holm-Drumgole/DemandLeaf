"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BriefReview } from "@/components/brief/brief-review";
import type { BriefData } from "@/types";

interface BriefDoc {
  _id: string;
  briefData: BriefData;
  status: string;
  keywordId: string;
  workspaceId: string;
}

export default function BriefDetailPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const { id: briefId } = useParams<{ id: string }>();

  const [brief, setBrief] = useState<BriefDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push("/sign-in");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !briefId) return;

    fetch(`/api/brief/${briefId}`)
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load brief");
        }
        return response.json();
      })
      .then((data) => setBrief(data.brief))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load brief"),
      )
      .finally(() => setIsLoading(false));
  }, [isLoaded, isSignedIn, briefId]);

  if (!isLoaded || !isSignedIn) return null;

  if (isLoading) {
    return (
      <main className="container max-w-3xl py-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (error || !brief) {
    return (
      <main className="container max-w-3xl py-8">
        <p className="text-destructive">{error ?? "Brief not found."}</p>
        <Button variant="link" onClick={() => router.push("/keywords")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Keywords
        </Button>
      </main>
    );
  }

  return (
    <main className="container max-w-3xl py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/keywords")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Content Brief</h1>
          <p className="text-muted-foreground text-sm">{brief.briefData.targetKeyword}</p>
        </div>
      </div>
      <BriefReview
        briefId={brief._id}
        briefData={brief.briefData}
        status={brief.status}
      />
    </main>
  );
}
