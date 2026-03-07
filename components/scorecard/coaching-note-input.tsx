"use client";

import { Textarea } from "@/components/ui/textarea";
import { MAX_COACHING_NOTE_LENGTH } from "@/lib/scorecard/tags";

interface CoachingNoteInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function CoachingNoteInput({ value, onChange }: CoachingNoteInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Coaching Note (optional)</label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_COACHING_NOTE_LENGTH))}
        placeholder="e.g., &quot;We never open articles with a question. Always start with a statement.&quot;"
        className="text-sm resize-none h-20"
        maxLength={MAX_COACHING_NOTE_LENGTH}
      />
      <p className="text-[11px] text-muted-foreground text-right">
        {value.length}/{MAX_COACHING_NOTE_LENGTH}
      </p>
    </div>
  );
}
