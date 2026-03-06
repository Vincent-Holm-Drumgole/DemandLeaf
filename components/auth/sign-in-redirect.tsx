"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { sanitizeRelativeRedirectUrl } from "@/lib/safe-redirect";

export function SignInRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const currentPath = query ? `${pathname}?${query}` : pathname;
    const redirectUrl = sanitizeRelativeRedirectUrl(currentPath, "/");
    router.replace(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
  }, [pathname, router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting to sign in...</p>
    </div>
  );
}
