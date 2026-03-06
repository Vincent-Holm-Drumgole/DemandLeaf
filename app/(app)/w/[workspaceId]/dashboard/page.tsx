"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BlogCard } from "@/components/dashboard/blog-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { buildWorkspacePath } from "@/lib/workspace-paths";
import type { DashboardResponse } from "@/types";
import { useAuthGuard } from "@/hooks/use-auth-guard";

export default function DashboardPage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard");
        if (response.ok) {
          const json: DashboardResponse = await response.json();
          setData(json);
        } else {
          setError("Failed to load dashboard");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [isLoaded, isSignedIn]);

  async function loadMore() {
    if (!data?.nextCursor) return;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const response = await fetch(`/api/dashboard?cursor=${encodeURIComponent(data.nextCursor)}`);
      if (response.ok) {
        const json: DashboardResponse = await response.json();
        setData((prev) => prev
          ? { ...json, blogs: [...prev.blogs, ...json.blogs] }
          : json
        );
      } else {
        setLoadMoreError("Failed to load more. Please try again.");
      }
    } catch {
      setLoadMoreError("Something went wrong. Please try again.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (!isLoaded || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
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

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">{data.workspaceName}</h1>
            <p className="text-sm text-muted-foreground">
              {data.blogs.length} of {data.total} blog{data.total !== 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => router.push(buildWorkspacePath(currentWorkspace._id, "/keywords"))}>
            Write New Blog
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {data.blogs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="space-y-3">
              {data.blogs.map((blog) => (
                <BlogCard key={blog.id} blog={blog} />
              ))}
            </div>
            {data.nextCursor && (
              <div className="mt-6 flex flex-col items-center gap-2">
                {loadMoreError && (
                  <p className="text-sm text-destructive">{loadMoreError}</p>
                )}
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
