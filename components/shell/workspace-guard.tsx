"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function WorkspaceGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const workspace = useQuery(api.workspaces.getByClerkUser);
  const provisioning = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const needsProvision = isLoaded && isSignedIn && workspace === null;

  useEffect(() => {
    if (!needsProvision || provisioning.current) return;
    provisioning.current = true;

    async function provision() {
      try {
        const res = await fetch("/api/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          setError("Failed to set up workspace. Please try again.");
        }
      } catch {
        setError("Failed to set up workspace. Please try again.");
      } finally {
        provisioning.current = false;
      }
    }

    provision();
  }, [needsProvision, retryCount]);

  if (!isLoaded || workspace === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <button
          onClick={() => {
            provisioning.current = false;
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

  if (needsProvision) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Setting up your workspace…</p>
      </div>
    );
  }

  return <>{children}</>;
}
