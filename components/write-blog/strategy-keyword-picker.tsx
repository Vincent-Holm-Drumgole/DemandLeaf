"use client";

import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWriteBlogStore } from "@/store/write-blog-store";

export function StrategyKeywordPicker() {
  const {
    strategies,
    keywords,
    selectedStrategyId,
    selectedKeywordId,
    loadingStrategies,
    loadingKeywords,
    loadStrategies,
    loadKeywordsForStrategy,
    selectStrategyKeyword,
  } = useWriteBlogStore();

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  if (loadingStrategies) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No strategies found. Create a strategy first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Strategy</label>
        <Select
          value={selectedStrategyId ?? ""}
          onValueChange={(val) => loadKeywordsForStrategy(val)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select a strategy" />
          </SelectTrigger>
          <SelectContent>
            {strategies.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedStrategyId && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Keyword</label>
          {loadingKeywords ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : keywords.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No keywords in this strategy
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-md border">
              {keywords.map((kw) => (
                <button
                  key={kw._id}
                  type="button"
                  onClick={() => selectStrategyKeyword(kw._id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${
                    selectedKeywordId === kw._id ? "bg-primary/5 border-l-2 border-primary" : ""
                  }`}
                >
                  <span className="truncate font-medium">{kw.keyword}</span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {kw.searchVolume !== undefined && kw.searchVolume > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {kw.searchVolume.toLocaleString()} vol
                      </Badge>
                    )}
                    {kw.keywordDifficulty !== undefined && kw.keywordDifficulty > 0 && (
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 ${
                          kw.keywordDifficulty <= 30
                            ? "text-green-600"
                            : kw.keywordDifficulty <= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        KD {kw.keywordDifficulty}
                      </Badge>
                    )}
                    {kw.searchIntent && (
                      <Badge variant="outline" className="text-[10px] px-1.5 capitalize">
                        {kw.searchIntent.slice(0, 4)}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
