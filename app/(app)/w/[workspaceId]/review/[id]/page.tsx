"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";
import { BlogContent } from "@/components/blog-editor/blog-content";
import { ExportBar } from "@/components/blog-editor/export-bar";
import { ScoreSidebar } from "@/components/scores/score-sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";

interface SavedBlogResponse {
  id: string;
  title: string;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
  wordCount: number | null;
  generationCostCents: number | null;
  generationTimeMs: number | null;
  scores: {
    seoScore: number | null;
    qualityScore: number | null;
    detectionRisk: string | null;
    detectionRiskScore: number | null;
    burstinessScore: number | null;
    readabilityScore: number | null;
  };
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const blogId = params.id as string;
  const { generationResult, sessionId } = useOnboardingStore();
  const [savedBlog, setSavedBlog] = useState<SavedBlogResponse | null>(null);
  const [savedBlogError, setSavedBlogError] = useState<string | null>(null);
  const [isLoadingSavedBlog, setIsLoadingSavedBlog] = useState(false);

  // If user navigates here directly without generating, redirect
  useEffect(() => {
    if (!generationResult && blogId === "preview") {
      router.push("/");
    }
  }, [generationResult, blogId, router]);

  // Load persisted blogs by ID for authenticated flows.
  useEffect(() => {
    if (blogId === "preview") return;

    let cancelled = false;
    setSavedBlog(null);
    setSavedBlogError(null);
    setIsLoadingSavedBlog(true);

    void (async () => {
      try {
        const res = await fetch(`/api/blog/${encodeURIComponent(blogId)}`, {
          cache: "no-store",
        });

        if (res.status === 401) {
          router.push(
            `/sign-in?redirect_url=${encodeURIComponent(
              buildWorkspacePath(currentWorkspace._id, `/review/${blogId}`),
            )}`,
          );
          return;
        }

        const body = (await res.json().catch(() => ({}))) as
          | SavedBlogResponse
          | { error?: string };
        if (!res.ok) {
          throw new Error(
            typeof body === "object" &&
              body !== null &&
              "error" in body &&
              typeof body.error === "string"
              ? body.error
              : "Failed to load blog"
          );
        }

        if (!cancelled) {
          setSavedBlog(body as SavedBlogResponse);
        }
      } catch (err) {
        if (!cancelled) {
          setSavedBlogError(err instanceof Error ? err.message : "Failed to load blog");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSavedBlog(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blogId, currentWorkspace._id, router]);

  // For the "preview" route (anonymous flow), use data from the store
  if (blogId === "preview" && generationResult) {
    return (
      <ReviewLayout
        content={generationResult.content}
        title={generationResult.title}
        metaTitle={generationResult.metaTitle}
        metaDescription={generationResult.metaDescription}
        scores={{
          seoScore: generationResult.scores.seoScore,
          qualityScore: generationResult.scores.qualityScore,
          detectionRisk: generationResult.scores.detectionRisk,
          detectionRiskScore: generationResult.scores.detectionRiskScore,
          burstinessScore: generationResult.scores.burstinessScore,
          readabilityScore: generationResult.scores.readabilityScore,
        }}
        wordCount={generationResult.wordCount}
        generationTimeMs={generationResult.generationTimeMs}
        totalCostCents={generationResult.totalCostCents}
        blogId={blogId}
        showSignupBanner={!sessionId}
      />
    );
  }

  if (blogId !== "preview" && isLoadingSavedBlog) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading blog...</p>
      </div>
    );
  }

  if (blogId !== "preview" && savedBlogError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">{savedBlogError}</p>
        <Button
          variant="outline"
          onClick={() => router.push(buildWorkspacePath(currentWorkspace._id, "/dashboard"))}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (blogId !== "preview" && savedBlog) {
    return (
      <ReviewLayout
        content={savedBlog.content}
        title={savedBlog.title}
        metaTitle={savedBlog.metaTitle}
        metaDescription={savedBlog.metaDescription}
        scores={savedBlog.scores}
        wordCount={savedBlog.wordCount}
        generationTimeMs={savedBlog.generationTimeMs ?? undefined}
        totalCostCents={savedBlog.generationCostCents ?? undefined}
        blogId={savedBlog.id}
        showSignupBanner={false}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading blog...</p>
    </div>
  );
}

function ReviewLayout({
  content,
  title,
  metaTitle,
  metaDescription,
  scores,
  wordCount,
  generationTimeMs,
  totalCostCents,
  blogId,
  showSignupBanner,
}: {
  content: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  scores: {
    seoScore: number | null;
    qualityScore: number | null;
    detectionRisk: string | null;
    detectionRiskScore: number | null;
    burstinessScore: number | null;
    readabilityScore: number | null;
  };
  wordCount: number | null;
  generationTimeMs?: number;
  totalCostCents?: number;
  blogId: string;
  showSignupBanner: boolean;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">
              Meta: {metaTitle ?? "—"} | {metaDescription ?? "—"}
            </p>
          </div>
          <ExportBar blogId={blogId} />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* Content - 70% */}
          <div className="rounded-lg border bg-card p-6">
            <BlogContent content={content} />
          </div>

          {/* Score sidebar - 30% */}
          <div className="space-y-4">
            <ScoreSidebar
              scores={scores}
              wordCount={wordCount}
              generationTimeMs={generationTimeMs}
              totalCostCents={totalCostCents}
            />
          </div>
        </div>
      </div>

      {/* Signup banner for anonymous users */}
      {showSignupBanner && (
        <>
          <Separator />
          <div className="mx-auto max-w-6xl px-4 py-6 text-center">
            <h3 className="text-lg font-semibold">Save this blog and create more</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a free account to save your blog, access your dashboard,
              and generate unlimited content.
            </p>
            <Button
              onClick={() => router.push("/sign-up")}
              size="lg"
              className="mt-4"
            >
              Create Free Account
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
