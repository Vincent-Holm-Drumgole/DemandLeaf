"use client";

import type { KeyboardEvent } from "react";
import { useOnboardingStore } from "@/store/onboarding-store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ARCHETYPE_LIST } from "@/lib/constants/archetypes";

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
            <div className="space-y-2" role="radiogroup" aria-label="Blog format">
              {ARCHETYPE_LIST.map((option) => (
                <Card
                  key={option.id}
                  className={`cursor-pointer transition-colors ${
                    archetype === option.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/30"
                  }`}
                  role="radio"
                  aria-checked={archetype === option.id}
                  tabIndex={0}
                  onClick={() => setArchetype(option.id)}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setArchetype(option.id);
                    }
                  }}
                >
                  <CardContent className="flex items-start gap-3 py-3 px-4">
                    <div
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                        archetype === option.id
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
