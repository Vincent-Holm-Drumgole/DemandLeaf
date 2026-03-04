"use client";

import { SignIn } from "@clerk/nextjs";
import { useOnboardingStore } from "@/store/onboarding-store";

export default function SignInPage() {
  const sessionId = useOnboardingStore((s) => s.sessionId);
  const redirectUrl = sessionId
    ? `/onboarding/complete?sessionId=${encodeURIComponent(sessionId)}`
    : "/dashboard";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn forceRedirectUrl={redirectUrl} />
    </div>
  );
}
