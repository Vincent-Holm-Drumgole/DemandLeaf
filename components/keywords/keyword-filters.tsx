"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

export type KeywordIntent = "all" | "informational" | "commercial" | "transactional" | "navigational";
export type KeywordStatus = "all" | "unassigned" | "briefed" | "written" | "published" | "ranking";

export interface KeywordFilters {
  search: string;
  intent: KeywordIntent;
  status: KeywordStatus;
  clusterId: string;
}

interface KeywordFiltersProps {
  filters: KeywordFilters;
  clusterOptions: { id: string; name: string }[];
  onChange: (filters: KeywordFilters) => void;
}

export function KeywordFiltersBar({ filters, clusterOptions, onChange }: KeywordFiltersProps) {
  const update = (patch: Partial<KeywordFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search keywords…"
          className="pl-8"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
        />
      </div>

      <Select value={filters.intent} onValueChange={(v) => update({ intent: v as KeywordIntent })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Intent" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All intents</SelectItem>
          <SelectItem value="informational">Informational</SelectItem>
          <SelectItem value="commercial">Commercial</SelectItem>
          <SelectItem value="transactional">Transactional</SelectItem>
          <SelectItem value="navigational">Navigational</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.status} onValueChange={(v) => update({ status: v as KeywordStatus })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          <SelectItem value="briefed">Briefed</SelectItem>
          <SelectItem value="written">Written</SelectItem>
          <SelectItem value="published">Published</SelectItem>
          <SelectItem value="ranking">Ranking</SelectItem>
        </SelectContent>
      </Select>

      {clusterOptions.length > 0 && (
        <Select value={filters.clusterId} onValueChange={(v) => update({ clusterId: v })}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clusters</SelectItem>
            {clusterOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
