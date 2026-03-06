"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";

export function EmptyState() {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-4xl">&#9997;&#65039;</div>
      <h3 className="text-lg font-semibold">No blogs yet</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        Create your first blog post by analyzing your website and choosing a
        topic.
      </p>
      <Button onClick={() => router.push(buildWorkspacePath(currentWorkspace._id, "/keywords"))} className="mt-4">
        Write Your First Blog
      </Button>
    </div>
  );
}
