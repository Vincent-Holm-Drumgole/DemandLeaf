"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";

export default function OnboardingCompletePage() {
  const router = useRouter();
  const sessionId = useOnboardingStore((s) => s.sessionId);
  const reset = useOnboardingStore((s) => s.reset);
  const called = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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
          setError("Failed to set up workspace. Please try again.");
          return;
        }

        reset();
        router.replace("/dashboard");
      } catch (err) {
        console.error("[provision] error:", err);
        setError("Failed to set up workspace. Please try again.");
      }
    }

    provision();
  }, [sessionId, reset, router, retryCount]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <button
          onClick={() => {
            called.current = false;
            setError(null);
            setRetryCount((c) => c + 1);
          }}
          className="text-sm underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Setting up your workspace…</p>
    </div>
  );
}
