"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";
import { KeywordFiltersBar, type KeywordFilters } from "./keyword-filters";
import { KeywordTable, type KeywordRow } from "./keyword-table";

interface KeywordExplorerProps {
  keywords: KeywordRow[];
  clusterOptions?: { id: string; name: string }[];
}

export function KeywordExplorer({ keywords, clusterOptions = [] }: KeywordExplorerProps) {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [filters, setFilters] = useState<KeywordFilters>({
    search: "",
    intent: "all",
    status: "all",
    clusterId: "all",
  });
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [briefError, setBriefError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return keywords.filter((kw) => {
      if (filters.search && !kw.keyword.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.intent !== "all" && kw.searchIntent !== filters.intent) return false;
      if (filters.status !== "all" && kw.status !== filters.status) return false;
      if (filters.clusterId !== "all" && kw.clusterId !== filters.clusterId) return false;
      return true;
    });
  }, [keywords, filters]);

  const handleGenerateBrief = async (keywordId: string) => {
    if (!currentWorkspace?._id) return;
    setBriefError(null);
    setIsGenerating(keywordId);
    try {
      const res = await fetch("/api/brief/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywordId }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(buildWorkspacePath(currentWorkspace._id, `/brief/${data.briefId}`));
      } else {
        setBriefError("Failed to generate brief. Please try again.");
      }
    } catch {
      setBriefError("Network error. Please try again.");
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <div>
      {briefError && <p className="text-sm text-destructive mb-2">{briefError}</p>}
      <KeywordFiltersBar
        filters={filters}
        clusterOptions={clusterOptions}
        onChange={setFilters}
      />
      <div className="text-sm text-muted-foreground mb-2">
        {filtered.length} of {keywords.length} keywords
      </div>
      <KeywordTable
        keywords={filtered}
        onGenerateBrief={handleGenerateBrief}
        generatingId={isGenerating}
      />
    </div>
  );
}
