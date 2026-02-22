"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";
import { BlogContent } from "@/components/blog-editor/blog-content";
import { ExportBar } from "@/components/blog-editor/export-bar";
import { ScoreSidebar } from "@/components/scores/score-sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const blogId = params.id as string;
  const { generationResult, sessionId } = useOnboardingStore();

  // If user navigates here directly without generating, redirect
  useEffect(() => {
    if (!generationResult && blogId === "preview") {
      router.push("/");
    }
  }, [generationResult, blogId, router]);

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

  // For real blog IDs, we'd fetch from the API (handled in Step 12)
  if (!generationResult) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading blog...</p>
      </div>
    );
  }

  return null;
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
  metaTitle: string;
  metaDescription: string;
  scores: {
    seoScore: number | null;
    qualityScore: number | null;
    detectionRisk: string | null;
    detectionRiskScore: number | null;
    burstinessScore: number | null;
    readabilityScore: number | null;
  };
  wordCount: number;
  generationTimeMs: number;
  totalCostCents: number;
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
              Meta: {metaTitle} | {metaDescription}
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
              onClick={() => router.push("/signup")}
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
