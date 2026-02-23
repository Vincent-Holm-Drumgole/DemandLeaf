"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";

export default function OnboardingCompletePage() {
  const router = useRouter();
  const sessionId = useOnboardingStore((s) => s.sessionId);
  const reset = useOnboardingStore((s) => s.reset);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    async function provision() {
      try {
        const response = await fetch("/api/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId ?? undefined }),
        });

        if (!response.ok) {
          console.error("[provision] failed:", await response.text());
        }
      } catch (err) {
        console.error("[provision] error:", err);
      } finally {
        reset();
        router.replace("/dashboard");
      }
    }

    provision();
  }, [sessionId, reset, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Setting up your workspace…</p>
    </div>
  );
}
