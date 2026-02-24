"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface OverlappingBlog {
  id: string;
  title: string;
  similarity: number;
}

interface CannibalizationWarningProps {
  overlappingBlogs?: OverlappingBlog[];
  note?: string;
  onOverride?: () => void;
}

export function CannibalizationWarning({
  overlappingBlogs = [],
  note,
  onOverride,
}: CannibalizationWarningProps) {
  if (overlappingBlogs.length === 0 && !note) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Potential Keyword Cannibalization</AlertTitle>
      <AlertDescription>
        {note && <p className="mb-2">{note}</p>}
        {overlappingBlogs.length > 0 && (
          <>
            <p className="mb-2">
              This keyword semantically overlaps with {overlappingBlogs.length} existing{" "}
              {overlappingBlogs.length === 1 ? "post" : "posts"}. Creating another post may split
              ranking signals.
            </p>
            <ul className="space-y-1 mb-3">
              {overlappingBlogs.map((blog) => (
                <li key={blog.id} className="flex items-center gap-2 text-sm">
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  <a href="/dashboard" className="underline hover:no-underline">
                    {blog.title}
                  </a>
                  <span className="text-muted-foreground">
                    ({Math.round(blog.similarity * 100)}% similarity)
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {onOverride && (
          <Button size="sm" variant="outline" onClick={onOverride}>
            Proceed anyway
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
