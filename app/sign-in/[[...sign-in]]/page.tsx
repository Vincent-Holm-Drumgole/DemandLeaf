"use client";

import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useOnboardingStore } from "@/store/onboarding-store";
import { sanitizeRelativeRedirectUrl } from "@/lib/safe-redirect";

function SignInPageContent() {
  const sessionId = useOnboardingStore((s) => s.sessionId);
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get("redirect_url");
  const fallbackRedirect = sessionId
    ? `/onboarding/complete?sessionId=${encodeURIComponent(sessionId)}`
    : "/";
  const redirectUrl = sanitizeRelativeRedirectUrl(requestedRedirect, fallbackRedirect);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn forceRedirectUrl={redirectUrl} />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <SignInPageContent />
    </Suspense>
  );
}
