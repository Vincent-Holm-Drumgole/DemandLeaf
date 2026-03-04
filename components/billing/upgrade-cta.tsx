"use client";

import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";

export function UpgradeCTA() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border bg-muted/30 px-6 py-12 text-center">
      <Lock className="mb-4 h-10 w-10 text-muted-foreground" />
      <h2 className="mb-2 text-lg font-semibold">Subscription Required</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Your free trial has ended. Subscribe to continue using all DemandLeaf
        features. Your existing content is safe and accessible.
      </p>
      <Button asChild>
        <Link href="/settings?tab=billing">Subscribe Now</Link>
      </Button>
    </div>
  );
}
