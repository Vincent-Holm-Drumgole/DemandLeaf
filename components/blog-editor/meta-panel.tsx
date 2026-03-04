"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface MetaFields {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
}

interface MetaPanelProps {
  fields: MetaFields;
  onChange: (fields: Partial<MetaFields>) => void;
}

export function MetaPanel({ fields, onChange }: MetaPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">SEO Meta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Focus Keyword</Label>
          <Input
            value={fields.focusKeyword}
            onChange={(e) => onChange({ focusKeyword: e.target.value })}
            placeholder="e.g. content marketing"
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Slug</Label>
          <Input
            value={fields.slug}
            onChange={(e) => onChange({ slug: e.target.value })}
            placeholder="url-friendly-slug"
            className="h-8 text-sm font-mono"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Meta Title</Label>
          <Input
            value={fields.metaTitle}
            onChange={(e) => onChange({ metaTitle: e.target.value })}
            placeholder="Page title for search engines"
            className="h-8 text-sm"
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {fields.metaTitle.length}/60
          </p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Meta Description</Label>
          <Textarea
            value={fields.metaDescription}
            onChange={(e) => onChange({ metaDescription: e.target.value })}
            placeholder="Brief description for search result snippets"
            rows={3}
            className="text-sm resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {fields.metaDescription.length}/160
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
