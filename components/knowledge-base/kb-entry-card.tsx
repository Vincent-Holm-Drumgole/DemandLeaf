"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { KBEntry, KBEntryType } from "@/types";
import { KB_REVIEW_DANGER_DAYS, KB_REVIEW_WARNING_DAYS } from "@/lib/knowledge-base/constants";

const TYPE_COLORS: Record<KBEntryType, string> = {
  company_info: "bg-blue-100 text-blue-800",
  product: "bg-green-100 text-green-800",
  audience: "bg-purple-100 text-purple-800",
  competitor: "bg-orange-100 text-orange-800",
  industry: "bg-teal-100 text-teal-800",
  customer_story: "bg-pink-100 text-pink-800",
  expert_insight: "bg-indigo-100 text-indigo-800",
  proprietary_data: "bg-yellow-100 text-yellow-800",
  hot_take: "bg-red-100 text-red-800",
  lesson_learned: "bg-lime-100 text-lime-800",
  methodology: "bg-cyan-100 text-cyan-800",
  thought_leadership_position: "bg-violet-100 text-violet-800",
};

const EMBEDDING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Indexing…", color: "text-yellow-600" },
  ready: { label: "Indexed", color: "text-green-600" },
  failed: { label: "Index failed", color: "text-red-600" },
};

interface KBEntryCardProps {
  entry: KBEntry;
  onEdit: (entry: KBEntry) => void;
  onDelete: (id: string) => void;
  onViewHistory: (entry: KBEntry) => void;
}

export function KBEntryCard({ entry, onEdit, onDelete, onViewHistory }: KBEntryCardProps) {
  const [renderedAt] = useState(() => Date.now());
  const typeLabel = entry.entryType.replace(/_/g, " ");
  const typeColor = TYPE_COLORS[entry.entryType] ?? "bg-gray-100 text-gray-800";
  const embeddingStatus = EMBEDDING_STATUS_LABELS[entry.embeddingStatus] ?? EMBEDDING_STATUS_LABELS.pending;
  const lastVerifiedAt = entry.lastVerifiedAt ?? entry.updatedAt;
  const ageDays = Math.floor((renderedAt - lastVerifiedAt) / (24 * 60 * 60 * 1000));
  const freshnessTone =
    ageDays >= KB_REVIEW_DANGER_DAYS
      ? "text-red-600"
      : ageDays >= KB_REVIEW_WARNING_DAYS
        ? "text-amber-600"
        : "text-green-600";

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${typeColor}`}>
              {typeLabel}
            </span>
            <h3 className="font-semibold text-sm leading-tight truncate">{entry.title}</h3>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onViewHistory(entry)}
            >
              History
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onEdit(entry)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => onDelete(entry.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground line-clamp-2">{entry.content}</p>
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs py-0">
              {entry.capabilityStatus === "planned" ? "Planned" : "Current"}
            </Badge>
            <Badge variant="outline" className="text-xs py-0">
              {entry.claims.length} claim{entry.claims.length === 1 ? "" : "s"}
            </Badge>
            {entry.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs py-0">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="text-right">
            <span className={`block text-xs ${embeddingStatus.color}`}>
              {embeddingStatus.label}
            </span>
            <span className={`block text-[11px] ${freshnessTone}`}>
              Verified {ageDays}d ago
            </span>
          </div>
        </div>
        {entry.discoveryNotes && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            Notes: {entry.discoveryNotes}
          </p>
        )}
        {entry.embeddingError && entry.embeddingStatus === "failed" && (
          <p className="mt-2 text-xs text-destructive line-clamp-2">
            {entry.embeddingError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
