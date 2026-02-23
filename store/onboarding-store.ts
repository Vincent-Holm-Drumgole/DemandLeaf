import { create } from "zustand";
import type { Archetype, PipelineStep } from "@/types";
import type { CrawlResponse, GenerateResult } from "@/types";

type OnboardingStep =
  | "landing"
  | "crawling"
  | "crawl-results"
  | "blog-setup"
  | "generating"
  | "review";

interface OnboardingState {
  // Navigation
  currentStep: OnboardingStep;

  // Crawl
  url: string;
  sessionId: string | null;
  crawlResult: CrawlResponse | null;
  crawlError: string | null;
  isCrawling: boolean;

  // Blog setup
  keyword: string;
  archetype: Archetype;

  // Generation
  generationSteps: PipelineStep[];
  generationResult: GenerateResult | null;
  generationError: string | null;
  isGenerating: boolean;

  // Actions
  setUrl: (url: string) => void;
  setKeyword: (keyword: string) => void;
  setArchetype: (archetype: Archetype) => void;
  setCurrentStep: (step: OnboardingStep) => void;

  startCrawl: () => Promise<void>;
  updateCrawlResult: (field: Partial<CrawlResponse>) => void;
  startGeneration: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  currentStep: "landing" as OnboardingStep,
  url: "",
  sessionId: null as string | null,
  crawlResult: null as CrawlResponse | null,
  crawlError: null as string | null,
  isCrawling: false,
  keyword: "",
  archetype: "how_to" as Archetype,
  generationSteps: [] as PipelineStep[],
  generationResult: null as GenerateResult | null,
  generationError: null as string | null,
  isGenerating: false,
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialState,

  setUrl: (url) => set({ url }),
  setKeyword: (keyword) => set({ keyword }),
  setArchetype: (archetype) => set({ archetype }),
  setCurrentStep: (step) => set({ currentStep: step }),

  updateCrawlResult: (field) =>
    set((state) => ({
      crawlResult: state.crawlResult
        ? { ...state.crawlResult, ...field }
        : null,
    })),

  startCrawl: async () => {
    const { url } = get();
    set({
      isCrawling: true,
      crawlError: null,
      currentStep: "crawling",
    });

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        let errorMessage = "Crawl failed";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMessage);
      }

      const data: CrawlResponse = await response.json();
      set({
        sessionId: data.sessionId,
        crawlResult: data,
        isCrawling: false,
        currentStep: "crawl-results",
      });
    } catch (err) {
      set({
        crawlError:
          err instanceof Error ? err.message : "Something went wrong",
        isCrawling: false,
        currentStep: "landing",
      });
    }
  },

  startGeneration: async () => {
    const { sessionId, keyword, archetype } = get();
    if (!sessionId) return;

    set({
      isGenerating: true,
      generationError: null,
      generationSteps: [],
      generationResult: null,
      currentStep: "generating",
    });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, keyword, archetype }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Generation failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "progress" && event.step) {
              set((state) => {
                const steps = [...state.generationSteps];
                const existing = steps.findIndex(
                  (s) => s.name === event.step.name
                );
                if (existing >= 0) {
                  steps[existing] = event.step;
                } else {
                  steps.push(event.step);
                }
                return { generationSteps: steps };
              });
            }

            if (event.type === "complete" && event.result) {
              set({
                generationResult: event.result,
                isGenerating: false,
                currentStep: "review",
              });
            }

            if (event.type === "error") {
              throw new Error(event.message || "Generation failed");
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) {
              // Ignore JSON parse errors from partial SSE chunks
              continue;
            }
            throw parseErr;
          }
        }
      }
    } catch (err) {
      set({
        generationError:
          err instanceof Error ? err.message : "Something went wrong",
        isGenerating: false,
      });
    }
  },

  reset: () => set(initialState),
}));
