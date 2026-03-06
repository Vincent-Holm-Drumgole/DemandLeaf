"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { buildSignInRedirectHref } from "@/lib/safe-redirect";

export function useAuthGuard() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      const currentPath =
        typeof window === "undefined"
          ? "/"
          : `${window.location.pathname}${window.location.search}`;
      router.replace(buildSignInRedirectHref(currentPath, "/"));
    }
  }, [isLoaded, isSignedIn, router]);

  return { isLoaded, isSignedIn };
}
