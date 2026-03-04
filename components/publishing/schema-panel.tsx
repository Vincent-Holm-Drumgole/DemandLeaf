"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import type { SchemaType } from "@/types";

interface SchemaPanelProps {
  schemaType: SchemaType | null;
  schemaJson: string | null;
}

export function SchemaPanel({ schemaType, schemaJson }: SchemaPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!schemaJson) return;
    try {
      await navigator.clipboard.writeText(schemaJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied or unavailable
    }
  }

  if (!schemaType || !schemaJson) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Schema Markup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Run AEO scoring to generate schema markup.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Schema Markup</CardTitle>
          <Badge variant="secondary" className="text-[10px]">
            {schemaType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {expanded ? "Hide" : "Preview"} JSON-LD
        </button>
        {expanded && (
          <div className="relative">
            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-[10px] leading-tight">
              {schemaJson}
            </pre>
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1 h-6 w-6"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
