"use client";

import { Badge } from "@/components/ui/badge";

interface DetectionBadgeProps {
  risk: string | null;
}

export function DetectionBadge({ risk }: DetectionBadgeProps) {
  if (!risk) return <Badge variant="outline">Unknown</Badge>;

  const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    low: { label: "Low Risk", variant: "default" },
    medium: { label: "Medium Risk", variant: "secondary" },
    high: { label: "High Risk", variant: "destructive" },
  };

  const info = config[risk];
  if (!info) return <Badge variant="outline">Unknown</Badge>;

  return <Badge variant={info.variant}>{info.label}</Badge>;
}
