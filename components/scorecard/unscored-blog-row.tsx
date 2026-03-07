"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildWorkspacePath } from "@/lib/workspace-paths";

interface UnscoredBlog {
  blogId: string;
  title: string;
  archetype: string;
  createdAt: number;
  wordCount: number | null;
  seoScore: number | null;
  voiceMatchScore: number | null;
}

interface UnscoredBlogRowProps {
  blog: UnscoredBlog;
  workspaceId: string;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatArchetype(archetype: string) {
  return archetype
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function UnscoredBlogRow({ blog, workspaceId }: UnscoredBlogRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 bg-card">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium truncate">{blog.title}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {formatArchetype(blog.archetype)}
          </Badge>
          <span>{formatDate(blog.createdAt)}</span>
          {blog.wordCount && <span>{blog.wordCount.toLocaleString()} words</span>}
        </div>
      </div>
      <Button asChild size="sm" variant="default">
        <Link href={buildWorkspacePath(workspaceId, `/scorecard/${blog.blogId}`)}>
          Score
        </Link>
      </Button>
    </div>
  );
}
