"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { buildSignInRedirectHref } from "@/lib/safe-redirect";

export function SignInRedirect() {
  const router = useRouter();

  useEffect(() => {
    const currentPath =
      typeof window === "undefined"
        ? "/"
        : `${window.location.pathname}${window.location.search}`;
    router.replace(buildSignInRedirectHref(currentPath, "/"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting to sign in...</p>
    </div>
  );
}
