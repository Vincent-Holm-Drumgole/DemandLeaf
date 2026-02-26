"use client";

import { useAuthGuard } from "@/hooks/use-auth-guard";
import { KBList } from "@/components/knowledge-base/kb-list";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function KnowledgeBasePage() {
  const { isLoaded, isSignedIn } = useAuthGuard();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Link>
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-xl font-semibold">Knowledge Base</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <p className="text-sm text-muted-foreground mb-6">
          Add company knowledge that gets automatically injected into relevant blog posts.
          Entries are embedded for semantic search — the most relevant context is selected per post.
        </p>
        <KBList />
      </div>
    </div>
  );
}
