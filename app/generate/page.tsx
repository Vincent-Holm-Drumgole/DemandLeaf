"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useOnboardingStore } from "@/store/onboarding-store";
import { BlogSetup } from "@/components/onboarding/blog-setup";
import { GenerationProgress } from "@/components/onboarding/generation-progress";

export default function GeneratePage() {
  const router = useRouter();
  const { currentStep, sessionId, generationResult } = useOnboardingStore();

  // Redirect if no session
  useEffect(() => {
    if (!sessionId) {
      router.push("/");
    }
  }, [sessionId, router]);

  // Redirect to review when complete
  useEffect(() => {
    if (currentStep === "review" && generationResult) {
      router.push(`/review/${generationResult.blogId || "preview"}`);
    }
  }, [currentStep, generationResult, router]);

  if (!sessionId) return null;

  if (currentStep === "generating") {
    return <GenerationProgress />;
  }

  return <BlogSetup />;
}
