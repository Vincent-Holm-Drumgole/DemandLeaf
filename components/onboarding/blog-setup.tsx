"use client";

import { useOnboardingStore } from "@/store/onboarding-store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Archetype } from "@/types";

const ARCHETYPE_OPTIONS: {
  value: Archetype;
  label: string;
  description: string;
}[] = [
  {
    value: "how_to",
    label: "How-To Guide",
    description: "Step-by-step instructions that solve a specific problem",
  },
  {
    value: "listicle",
    label: "Listicle",
    description: "Numbered list of tips, tools, or strategies",
  },
  {
    value: "definitive_guide",
    label: "Definitive Guide",
    description: "Comprehensive deep-dive on a topic (2500+ words)",
  },
];

export function BlogSetup() {
  const {
    keyword,
    setKeyword,
    archetype,
    setArchetype,
    startGeneration,
    crawlResult,
  } = useOnboardingStore();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (keyword.trim().length < 2) return;
    startGeneration();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        <h2 className="text-2xl font-semibold text-foreground text-center">
          What should we write about?
        </h2>
        {crawlResult && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Writing for {crawlResult.companyName} in{" "}
            {crawlResult.industry}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="keyword"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Focus Keyword
            </label>
            <Input
              id="keyword"
              type="text"
              placeholder="e.g. content marketing strategy"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="h-12 text-base"
              autoFocus
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              The primary keyword your blog should rank for in search
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Blog Format
            </label>
            <div className="space-y-2">
              {ARCHETYPE_OPTIONS.map((option) => (
                <Card
                  key={option.value}
                  className={`cursor-pointer transition-colors ${
                    archetype === option.value
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setArchetype(option.value)}
                >
                  <CardContent className="flex items-start gap-3 py-3 px-4">
                    <div
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                        archetype === option.value
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={keyword.trim().length < 2}
            className="w-full h-12"
          >
            Generate Blog Post
          </Button>
        </form>
      </div>
    </div>
  );
}
