"use client";

export type ColorMode = "coverage" | "seo" | "buyerStage" | "archetype";

interface ViewToggleProps {
  value: ColorMode;
  onChange: (mode: ColorMode) => void;
}

const OPTIONS: { value: ColorMode; label: string }[] = [
  { value: "coverage", label: "Coverage" },
  { value: "seo", label: "SEO Score" },
  { value: "buyerStage", label: "Buyer Stage" },
  { value: "archetype", label: "Archetype" },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-md border bg-muted p-0.5 text-xs">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            "px-3 py-1 rounded-sm transition-colors",
            value === opt.value
              ? "bg-background text-foreground shadow-sm font-medium"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
