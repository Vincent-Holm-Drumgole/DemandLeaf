"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-fetch";
import { UnscoredBlogRow } from "./unscored-blog-row";
import { CheckCircle2 } from "lucide-react";

interface UnscoredBlog {
  blogId: string;
  title: string;
  archetype: string;
  createdAt: number;
  wordCount: number | null;
  seoScore: number | null;
  voiceMatchScore: number | null;
}

interface ReviewQueueProps {
  workspaceId: string;
  totalScored?: number;
}

export function ReviewQueue({ workspaceId, totalScored }: ReviewQueueProps) {
  const [blogs, setBlogs] = useState<UnscoredBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/scorecard/queue", {
          headers: { "x-workspace-id": workspaceId },
        });
        if (!res.ok) throw new Error("Failed to load queue");
        const data = await res.json();
        setBlogs(data.blogs);
      } catch {
        setError("Failed to load review queue");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (blogs.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
        <p className="font-semibold">You&apos;re all caught up!</p>
        <p className="text-sm text-muted-foreground">
          Your AI has learned from {totalScored ?? 0} scored output{totalScored !== 1 ? "s" : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {blogs.map((blog) => (
        <UnscoredBlogRow key={blog.blogId} blog={blog} workspaceId={workspaceId} />
      ))}
    </div>
  );
}
