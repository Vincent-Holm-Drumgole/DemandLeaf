import { create } from "zustand";
import type { Archetype, PipelineStep } from "@/types";

type WriteBlogStep = "choose" | "configure" | "generating" | "complete";
type WriteBlogMode = "quick" | "strategy" | "calendar";

interface StrategyItem {
  _id: string;
  name: string;
  seedKeywords: string[];
}

interface KeywordItem {
  _id: string;
  keyword: string;
  searchVolume?: number;
  keywordDifficulty?: number;
  searchIntent?: string;
  opportunityScore?: number;
  status?: string;
  briefId?: string;
}

interface CalendarItem {
  _id: string;
  keyword: string;
  archetype: string;
  scheduledDate: number;
  status: string;
  briefId?: string;
}

interface WriteBlogState {
  isOpen: boolean;
  step: WriteBlogStep;
  mode: WriteBlogMode;

  // Quick write
  keyword: string;
  archetype: Archetype;

  // Strategy path
  strategies: StrategyItem[];
  keywords: KeywordItem[];
  selectedStrategyId: string | null;
  selectedKeywordId: string | null;
  loadingStrategies: boolean;
  loadingKeywords: boolean;

  // Calendar path
  calendarItems: CalendarItem[];
  selectedCalendarItemId: string | null;
  loadingCalendar: boolean;

  // Generation
  generationSteps: PipelineStep[];
  generationError: string | null;
  isGenerating: boolean;
  resultBlogId: string | null;

  // Actions
  open: () => void;
  close: () => void;
  reset: () => void;
  setMode: (mode: WriteBlogMode) => void;
  setKeyword: (keyword: string) => void;
  setArchetype: (archetype: Archetype) => void;
  loadStrategies: () => Promise<void>;
  loadKeywordsForStrategy: (strategyId: string) => Promise<void>;
  loadUpcomingCalendar: () => Promise<void>;
  selectStrategyKeyword: (keywordId: string) => void;
  selectCalendarItem: (itemId: string) => void;
  startGeneration: () => Promise<void>;
}

const initialState = {
  isOpen: false,
  step: "choose" as WriteBlogStep,
  mode: "quick" as WriteBlogMode,
  keyword: "",
  archetype: "how_to" as Archetype,
  strategies: [] as StrategyItem[],
  keywords: [] as KeywordItem[],
  selectedStrategyId: null as string | null,
  selectedKeywordId: null as string | null,
  loadingStrategies: false,
  loadingKeywords: false,
  calendarItems: [] as CalendarItem[],
  selectedCalendarItemId: null as string | null,
  loadingCalendar: false,
  generationSteps: [] as PipelineStep[],
  generationError: null as string | null,
  isGenerating: false,
  resultBlogId: null as string | null,
};

export const useWriteBlogStore = create<WriteBlogState>((set, get) => ({
  ...initialState,

  open: () => set({ isOpen: true, step: "choose" }),
  close: () => {
    if (get().isGenerating) return; // don't close during generation
    set(initialState);
  },
  reset: () => set(initialState),

  setMode: (mode) => set({ mode, step: "configure" }),
  setKeyword: (keyword) => set({ keyword }),
  setArchetype: (archetype) => set({ archetype }),

  loadStrategies: async () => {
    set({ loadingStrategies: true });
    try {
      const res = await fetch("/api/strategy");
      if (!res.ok) return;
      const data = await res.json();
      set({ strategies: data.strategies ?? [] });
    } catch {
      // silent
    } finally {
      set({ loadingStrategies: false });
    }
  },

  loadKeywordsForStrategy: async (strategyId) => {
    set({ selectedStrategyId: strategyId, loadingKeywords: true, keywords: [] });
    try {
      const res = await fetch(`/api/strategy/${strategyId}`);
      if (!res.ok) return;
      const data = await res.json();
      set({ keywords: data.keywords ?? [] });
    } catch {
      // silent
    } finally {
      set({ loadingKeywords: false });
    }
  },

  loadUpcomingCalendar: async () => {
    set({ loadingCalendar: true });
    try {
      const res = await fetch("/api/calendar?upcoming=true");
      if (!res.ok) return;
      const data = await res.json();
      set({ calendarItems: data.items ?? [] });
    } catch {
      // silent
    } finally {
      set({ loadingCalendar: false });
    }
  },

  selectStrategyKeyword: (keywordId) => {
    const kw = get().keywords.find((k) => k._id === keywordId);
    if (kw) {
      set({
        selectedKeywordId: keywordId,
        keyword: kw.keyword,
        archetype: (kw as any).archetype ?? "how_to",
      });
    }
  },

  selectCalendarItem: (itemId) => {
    const item = get().calendarItems.find((c) => c._id === itemId);
    if (item) {
      set({
        selectedCalendarItemId: itemId,
        keyword: item.keyword,
        archetype: (item.archetype ?? "how_to") as Archetype,
      });
    }
  },

  startGeneration: async () => {
    const { keyword, archetype, mode, selectedCalendarItemId } = get();
    if (!keyword.trim()) return;

    set({
      isGenerating: true,
      generationError: null,
      generationSteps: [],
      resultBlogId: null,
      step: "generating",
    });

    try {
      const payload: Record<string, string> = { keyword, archetype };

      // Find briefId if available from strategy keyword
      if (mode === "strategy") {
        const kw = get().keywords.find((k) => k._id === get().selectedKeywordId);
        if (kw?.briefId) payload.briefId = kw.briefId;
      }

      if (mode === "calendar" && selectedCalendarItemId) {
        payload.calendarItemId = selectedCalendarItemId;
        const item = get().calendarItems.find((c) => c._id === selectedCalendarItemId);
        if (item?.briefId) payload.briefId = item.briefId;
      }

      const response = await fetch("/api/workspace-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
                const existing = steps.findIndex((s) => s.name === event.step.name);
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
                resultBlogId: event.result.blogId,
                isGenerating: false,
                step: "complete",
              });
            }

            if (event.type === "error") {
              throw new Error(event.message || "Generation failed");
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      set({
        generationError: err instanceof Error ? err.message : "Something went wrong",
        isGenerating: false,
      });
    }
  },
}));
