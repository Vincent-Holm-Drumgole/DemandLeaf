"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { readActiveWorkspaceCookie } from "@/lib/workspace-cookie";
import { buildWorkspacePath } from "@/lib/workspace-paths";

export default function OnboardingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaces = useQuery(api.workspaces.listForViewer, {});
  const isNewWorkspaceMode = searchParams.get("mode") === "new-workspace";

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isNewWorkspaceMode && workspaces && workspaces.length > 0) {
      const preferredWorkspaceId = readActiveWorkspaceCookie();
      const workspace =
        workspaces.find((entry) => entry._id === preferredWorkspaceId) ?? workspaces[0];
      router.replace(buildWorkspacePath(workspace._id, "/dashboard"));
    }
  }, [isNewWorkspaceMode, router, workspaces]);

  if (
    !isLoaded ||
    workspaces === undefined ||
    (!isNewWorkspaceMode && workspaces.length > 0)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <OnboardingWizard />;
}
