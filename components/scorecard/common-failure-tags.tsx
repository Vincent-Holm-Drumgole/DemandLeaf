"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FailureTag {
  dimension: string;
  dimensionLabel: string;
  tag: string;
  count: number;
}

interface CommonFailureTagsProps {
  tags: FailureTag[];
}

export function CommonFailureTags({ tags }: CommonFailureTagsProps) {
  if (tags.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Common Failure Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            No failure tags recorded yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Common Failure Tags</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tags.map((tag, i) => (
            <div key={`${tag.dimension}-${tag.tag}`} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {tag.dimensionLabel}
                </Badge>
                <span className="text-sm truncate">{tag.tag}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{tag.count}x</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
