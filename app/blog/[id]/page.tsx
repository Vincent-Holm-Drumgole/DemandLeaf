"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useBlogStore } from "@/store/blog-store";
import { BlogContent } from "@/components/blog-editor/blog-content";
import { ExportBar } from "@/components/blog-editor/export-bar";
import { ScoreSidebar } from "@/components/scores/score-sidebar";

export default function BlogPage() {
  const params = useParams();
  const blogId = params.id as string;
  const { blog, isLoading, error, fetchBlog } = useBlogStore();

  useEffect(() => {
    if (blogId) {
      fetchBlog(blogId);
    }
  }, [blogId, fetchBlog]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading blog...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!blog) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">{blog.title}</h1>
            <p className="text-xs text-muted-foreground">
              {blog.metaTitle} | {blog.focusKeyword}
            </p>
          </div>
          <ExportBar blogId={blog.id} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <div className="rounded-lg border bg-card p-6">
            <BlogContent content={blog.content} />
          </div>

          <ScoreSidebar
            scores={blog.scores}
            wordCount={blog.wordCount}
          />
        </div>
      </div>
    </div>
  );
}
