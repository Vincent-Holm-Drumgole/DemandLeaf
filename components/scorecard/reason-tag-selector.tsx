"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface ReasonTagSelectorProps {
  presetTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function ReasonTagSelector({
  presetTags,
  selectedTags,
  onTagsChange,
}: ReasonTagSelectorProps) {
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState("");

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  }

  function addOtherTag() {
    const trimmed = otherText.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      onTagsChange([...selectedTags, trimmed]);
      setOtherText("");
      setShowOther(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground font-medium">What went wrong?</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reason tags">
        {presetTags.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={selectedTags.includes(tag)}
            onClick={() => toggleTag(tag)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] border transition-colors",
              selectedTags.includes(tag)
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-card border-border text-muted-foreground hover:bg-accent/60"
            )}
          >
            {tag}
          </button>
        ))}
        {!showOther && (
          <button
            type="button"
            onClick={() => setShowOther(true)}
            className="px-2.5 py-1 rounded-full text-[11px] border border-dashed border-border text-muted-foreground hover:bg-accent/60"
          >
            + Other
          </button>
        )}
      </div>
      {showOther && (
        <div className="flex gap-1.5">
          <Input
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addOtherTag()}
            placeholder="Type a reason..."
            className="h-7 text-xs"
          />
          <button
            type="button"
            onClick={addOtherTag}
            className="px-2 h-7 rounded-md text-xs bg-accent text-accent-foreground hover:bg-accent/80"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
