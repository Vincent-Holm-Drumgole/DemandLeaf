"use client";

import { useState } from "react";
import { useOnboardingStore } from "@/store/onboarding-store";
import { CrawlProgress } from "@/components/onboarding/crawl-progress";
import { CrawlResults } from "@/components/onboarding/crawl-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LandingPage() {
  const {
    url,
    setUrl,
    currentStep,
    isCrawling,
    crawlError,
    crawlResult,
    startCrawl,
  } = useOnboardingStore();

  const [inputError, setInputError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInputError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setInputError("Please enter a website URL");
      return;
    }

    try {
      new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    } catch {
      setInputError("Please enter a valid URL");
      return;
    }

    const normalized = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;
    setUrl(normalized);
    startCrawl();
  }

  if (currentStep === "crawling") {
    return <CrawlProgress />;
  }

  if (currentStep === "crawl-results" && crawlResult) {
    return <CrawlResults />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Turn your website into
          <br />
          blog content that ranks
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Paste your URL. Get a publish-ready blog post in minutes.
          <br />
          Optimized for SEO. Written in your voice. No account needed.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex gap-3">
          <Input
            type="text"
            placeholder="https://yourcompany.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setInputError(null);
            }}
            disabled={isCrawling}
            className="h-12 text-base"
            autoFocus
          />
          <Button
            type="submit"
            disabled={isCrawling}
            size="lg"
            className="h-12 px-6 whitespace-nowrap"
          >
            {isCrawling ? "Analyzing..." : "Analyze My Site"}
          </Button>
        </form>

        {(inputError || crawlError) && (
          <p className="mt-3 text-sm text-destructive">
            {inputError || crawlError}
          </p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          We&apos;ll analyze your site to understand your brand voice and create
          content that sounds like you wrote it.
        </p>
      </div>
    </div>
  );
}
