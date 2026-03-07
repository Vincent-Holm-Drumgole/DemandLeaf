"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { PaywallGate } from "@/components/billing/paywall-gate";
import { BlogContent } from "@/components/blog-editor/blog-content";
import { ScorecardPanel } from "@/components/scorecard/scorecard-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { buildWorkspacePath } from "@/lib/workspace-paths";

interface BlogData {
  _id: string;
  title: string;
  content: string;
  archetype: string;
  focusKeyword?: string;
  wordCount?: number;
  seoScore?: number;
  voiceMatchScore?: number;
}

export default function ScoringPage() {
  const { isLoaded, isSignedIn } = useAuthGuard();
  const { currentWorkspace } = useWorkspace();
  const params = useParams();
  const router = useRouter();
  const blogId = typeof params.blogId === "string" ? params.blogId : "";

  const [blog, setBlog] = useState<BlogData | null>(null);
  const [alreadyScored, setAlreadyScored] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextBlogId, setNextBlogId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const workspaceHeaders = {
          "x-workspace-id": currentWorkspace._id,
        };
        const [blogRes, scoreRes, queueRes] = await Promise.all([
          apiFetch(`/api/blog/${blogId}`, { headers: workspaceHeaders }),
          apiFetch(`/api/scorecard/blog/${blogId}`, { headers: workspaceHeaders }),
          apiFetch("/api/scorecard/queue?limit=5", { headers: workspaceHeaders }),
        ]);

        if (!blogRes.ok) throw new Error("Blog not found");
        const blogData = await blogRes.json();
        setBlog(blogData);

        if (scoreRes.ok) {
          const scoreData = await scoreRes.json();
          setAlreadyScored(scoreData.score != null);
        }

        if (queueRes.ok) {
          const queueData = await queueRes.json();
          const others = (queueData.blogs ?? []).filter(
            (b: { blogId: string }) => b.blogId !== blogId
          );
          setNextBlogId(others[0]?.blogId ?? null);
        }
      } catch {
        setError("Failed to load blog");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [blogId, currentWorkspace._id]);

  function handleSubmitted() {
    setAlreadyScored(true);
  }

  function handleScoreNext() {
    if (nextBlogId) {
      router.push(buildWorkspacePath(currentWorkspace._id, `/scorecard/${nextBlogId}`));
    } else {
      router.push(buildWorkspacePath(currentWorkspace._id, "/scorecard"));
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!isSignedIn) return null;

  return (
    <PaywallGate>
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card sticky top-0 z-10">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    router.push(buildWorkspacePath(currentWorkspace._id, "/scorecard"))
                  }
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Queue
                </Button>
                {blog && (
                  <>
                    <span className="text-sm font-medium truncate max-w-xs">
                      {blog.title}
                    </span>
                    {blog.focusKeyword && (
                      <Badge variant="outline" className="text-[10px]">
                        {blog.focusKeyword}
                      </Badge>
                    )}
                  </>
                )}
              </div>
              {nextBlogId && (
                <Button size="sm" variant="outline" onClick={handleScoreNext}>
                  Score Next
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
              <Skeleton className="h-96 rounded-lg" />
              <Skeleton className="h-96 rounded-lg" />
            </div>
          ) : error || !blog ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-destructive">{error || "Blog not found"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
              <div className="rounded-lg border bg-card p-6 overflow-y-auto max-h-[calc(100vh-120px)]">
                <BlogContent content={blog.content} />
              </div>
              <div className="lg:sticky lg:top-20 lg:self-start">
                {alreadyScored ? (
                  <div className="rounded-lg border bg-card p-6 text-center space-y-2">
                    <p className="text-sm font-medium">Already Scored</p>
                    <p className="text-xs text-muted-foreground">
                      This output has already been scored.
                    </p>
                    <Button size="sm" variant="outline" onClick={handleScoreNext}>
                      {nextBlogId ? "Score Next" : "Back to Queue"}
                    </Button>
                  </div>
                ) : (
                  <ScorecardPanel blogId={blogId} onSubmitted={handleSubmitted} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PaywallGate>
  );
}
