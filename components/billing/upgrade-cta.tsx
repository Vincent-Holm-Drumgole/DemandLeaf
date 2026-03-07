"use client";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";
import { Lock } from "lucide-react";
import Link from "next/link";

export function UpgradeCTA() {
  const { currentWorkspace } = useWorkspace();

  if (!currentWorkspace) return null;

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border bg-muted/30 px-6 py-12 text-center">
      <Lock className="mb-4 h-10 w-10 text-muted-foreground" />
      <h2 className="mb-2 text-lg font-semibold">Subscription Required</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Subscribe to access all DemandLeaf features. Your existing content is
        safe and accessible.
      </p>
      <Button asChild>
        <Link href={buildWorkspacePath(currentWorkspace._id, "/settings?tab=billing")}>
          Subscribe Now
        </Link>
      </Button>
    </div>
  );
}
