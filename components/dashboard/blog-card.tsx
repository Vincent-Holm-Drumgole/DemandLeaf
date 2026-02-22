"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardBlog } from "@/types";

const ARCHETYPE_LABELS: Record<string, string> = {
  how_to: "How-To",
  listicle: "Listicle",
  definitive_guide: "Guide",
};

interface BlogCardProps {
  blog: DashboardBlog;
}

export function BlogCard({ blog }: BlogCardProps) {
  const archetypeLabel = ARCHETYPE_LABELS[blog.archetype] ?? blog.archetype;
  const seoColor =
    (blog.seoScore ?? 0) >= 80
      ? "text-green-600"
      : (blog.seoScore ?? 0) >= 60
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <Link href={`/blog/${blog.id}`}>
      <Card className="transition-colors hover:border-primary/40">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-2">
              {blog.title}
            </CardTitle>
            <Badge variant="outline" className="shrink-0 text-xs">
              {archetypeLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className={seoColor}>
              SEO {blog.seoScore ?? "—"}
            </span>
            <span>{blog.wordCount ?? "—"} words</span>
            <span className="ml-auto">
              {new Date(blog.createdAt).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
