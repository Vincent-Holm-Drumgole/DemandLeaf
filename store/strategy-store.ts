import { create } from "zustand";
import type { ClusterResult, SearchIntent } from "@/types";

export interface DiscoveredKeyword {
  keyword: string;
  searchVolume: number;
  keywordDifficulty: number;
  cpc: number;
  searchIntent: SearchIntent;
  opportunityScore: number;
}

interface StrategyState {
  currentStrategyId: string | null;
  wizardStep: 1 | 2 | 3 | 4 | 5;
  name: string;
  outcomes: string;
  targetAudience: string;
  seeds: string[];
  competitorDomains: string[];
  discoveredKeywords: DiscoveredKeyword[];
  clusters: ClusterResult[];
  isDiscovering: boolean;
  isClustering: boolean;
  error: string | null;

  setCurrentStrategy: (id: string) => void;
  setStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  saveName: (name: string) => void;
  saveOutcomes: (outcomes: string, targetAudience?: string) => void;
  saveSeeds: (seeds: string[], competitorDomains?: string[]) => void;
  runDiscovery: (strategyId: string) => Promise<void>;
  runClustering: (strategyId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  currentStrategyId: null,
  wizardStep: 1 as const,
  name: "",
  outcomes: "",
  targetAudience: "",
  seeds: [],
  competitorDomains: [],
  discoveredKeywords: [],
  clusters: [],
  isDiscovering: false,
  isClustering: false,
  error: null,
};

export const useStrategyStore = create<StrategyState>((set, get) => ({
  ...initialState,

  setCurrentStrategy: (id) => set({ currentStrategyId: id }),

  setStep: (step) => set({ wizardStep: step }),

  saveName: (name) => set({ name }),

  saveOutcomes: (outcomes, targetAudience) =>
    set({ outcomes, targetAudience: targetAudience ?? get().targetAudience }),

  saveSeeds: (seeds, competitorDomains) =>
    set({ seeds, competitorDomains: competitorDomains ?? get().competitorDomains }),

  runDiscovery: async (strategyId) => {
    const { competitorDomains } = get();
    set({ isDiscovering: true, error: null });
    try {
      const res = await fetch(`/api/strategy/${strategyId}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitorDomains }),
      });
      if (!res.ok) {
        let errorMsg = "Failed to discover keywords";
        try {
          const data = await res.json();
          errorMsg = data.error ?? errorMsg;
        } catch {
          // Non-JSON response
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();

      // Load full keyword details from the strategy endpoint
      const stratRes = await fetch(`/api/strategy/${strategyId}`);
      if (stratRes.ok) {
        const stratData = await stratRes.json();
        set({
          discoveredKeywords: (stratData.keywords ?? []).map(
            (kw: {
              keyword: string;
              searchVolume?: number;
              keywordDifficulty?: number;
              cpc?: number;
              searchIntent?: SearchIntent;
              opportunityScore?: number;
            }) => ({
              keyword: kw.keyword,
              searchVolume: kw.searchVolume ?? 0,
              keywordDifficulty: kw.keywordDifficulty ?? 0,
              cpc: kw.cpc ?? 0,
              searchIntent: kw.searchIntent ?? "informational",
              opportunityScore: kw.opportunityScore ?? 0,
            })
          ),
          isDiscovering: false,
        });
      } else {
        set({ isDiscovering: false });
      }
      void data; // acknowledge the initial response
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to discover keywords",
        isDiscovering: false,
      });
    }
  },

  runClustering: async (strategyId) => {
    set({ isClustering: true, error: null });
    try {
      const res = await fetch(`/api/strategy/${strategyId}/clusters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postsPerMonth: 4 }),
      });
      if (!res.ok) {
        let errorMsg = "Failed to cluster keywords";
        try {
          const data = await res.json();
          errorMsg = data.error ?? errorMsg;
        } catch {
          // Non-JSON response
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      set({ clusters: data.clusters ?? [], isClustering: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to cluster keywords",
        isClustering: false,
      });
    }
  },

  reset: () => set(initialState),
}));
