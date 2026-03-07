import { create } from "zustand";
import type { CrawlResponse } from "@/types";

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SetupStage =
  | "workspace"
  | "knowledge_base"
  | "voice"
  | "strategy"
  | "done";

interface SetupResult {
  workspaceId?: string;
  trialActive?: boolean;
  kbEntriesCreated?: number;
  strategyId?: string;
  keywordsDiscovering?: boolean;
}

interface OnboardingWizardState {
  step: WizardStep;

  // Step 1: Welcome
  workspaceName: string;

  // Step 2: Business
  companyDescription: string;
  url: string;
  industry: string;
  sessionId: string | null;
  crawlResult: CrawlResponse | null;
  crawlError: string | null;
  isCrawling: boolean;

  // Step 3: Audience
  audienceDescription: string;
  audienceExpertise: "beginner" | "intermediate" | "advanced" | "expert";

  // Step 4: Voice
  toneAttributes: string[];
  formality: number;
  avoidWords: string[];

  // Step 5: Goals
  businessOutcomes: string;
  seedKeywords: string[];
  competitorDomains: string[];

  // Step 6: Setup
  isSettingUp: boolean;
  setupStage: SetupStage;
  setupError: string | null;
  setupResult: SetupResult | null;

  // Actions
  setStep: (step: WizardStep) => void;
  setWorkspaceName: (name: string) => void;
  setCompanyDescription: (desc: string) => void;
  setUrl: (url: string) => void;
  setIndustry: (industry: string) => void;
  setAudienceDescription: (desc: string) => void;
  setAudienceExpertise: (level: "beginner" | "intermediate" | "advanced" | "expert") => void;
  setToneAttributes: (attrs: string[]) => void;
  setFormality: (val: number) => void;
  setAvoidWords: (words: string[]) => void;
  setBusinessOutcomes: (outcomes: string) => void;
  setSeedKeywords: (keywords: string[]) => void;
  setCompetitorDomains: (domains: string[]) => void;
  startCrawl: () => Promise<void>;
  runSetup: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  step: 1 as WizardStep,
  workspaceName: "My Workspace",
  companyDescription: "",
  url: "",
  industry: "",
  sessionId: null as string | null,
  crawlResult: null as CrawlResponse | null,
  crawlError: null as string | null,
  isCrawling: false,
  audienceDescription: "",
  audienceExpertise: "intermediate" as const,
  toneAttributes: [] as string[],
  formality: 5,
  avoidWords: [] as string[],
  businessOutcomes: "",
  seedKeywords: [] as string[],
  competitorDomains: [] as string[],
  isSettingUp: false,
  setupStage: "workspace" as SetupStage,
  setupError: null as string | null,
  setupResult: null as SetupResult | null,
};

export const useOnboardingWizardStore = create<OnboardingWizardState>(
  (set, get) => ({
    ...initialState,

    setStep: (step) => set({ step }),
    setWorkspaceName: (workspaceName) => set({ workspaceName }),
    setCompanyDescription: (companyDescription) => set({ companyDescription }),
    setUrl: (url) => set({ url }),
    setIndustry: (industry) => set({ industry }),
    setAudienceDescription: (audienceDescription) => set({ audienceDescription }),
    setAudienceExpertise: (audienceExpertise) => set({ audienceExpertise }),
    setToneAttributes: (toneAttributes) => set({ toneAttributes }),
    setFormality: (formality) => set({ formality }),
    setAvoidWords: (avoidWords) => set({ avoidWords }),
    setBusinessOutcomes: (businessOutcomes) => set({ businessOutcomes }),
    setSeedKeywords: (seedKeywords) => set({ seedKeywords }),
    setCompetitorDomains: (competitorDomains) => set({ competitorDomains }),

    startCrawl: async () => {
      const { url, isCrawling } = get();
      if (isCrawling) return;
      set({ isCrawling: true, crawlError: null });

      try {
        const normalizedUrl =
          url.startsWith("http://") || url.startsWith("https://")
            ? url
            : `https://${url}`;

        const response = await fetch("/api/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalizedUrl }),
        });

        if (!response.ok) {
          let errorMessage = "Could not analyze your website — no worries, just describe your business below.";
          try {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
          } catch {
            // not JSON
          }
          set({ crawlError: errorMessage, isCrawling: false });
          return;
        }

        const data: CrawlResponse = await response.json();
        set({
          sessionId: data.sessionId,
          crawlResult: data,
          isCrawling: false,
          industry: data.industry || get().industry,
          audienceDescription: data.audience || get().audienceDescription,
          workspaceName: data.companyName || get().workspaceName,
        });
      } catch {
        set({
          crawlError: "Could not reach your website — just describe your business below.",
          isCrawling: false,
        });
      }
    },

    runSetup: async () => {
      const state = get();
      if (state.isSettingUp) return;
      set({ isSettingUp: true, setupError: null, setupStage: "workspace", step: 6 });

      // Simulate staged progress while the API works
      const stages: SetupStage[] = ["workspace", "knowledge_base", "voice", "strategy"];
      let stageIdx = 0;
      const stageTimer = setInterval(() => {
        stageIdx++;
        if (stageIdx < stages.length) {
          set({ setupStage: stages[stageIdx] });
        }
      }, 2500);

      try {
        const response = await fetch("/api/onboarding/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceName: state.workspaceName.trim() || "My Workspace",
            companyDescription: state.companyDescription,
            websiteUrl: state.url || undefined,
            industry: state.industry,
            audienceDescription: state.audienceDescription,
            audienceExpertise: state.audienceExpertise,
            toneAttributes: state.toneAttributes,
            formality: state.formality,
            avoidWords: state.avoidWords.length > 0 ? state.avoidWords : undefined,
            businessOutcomes: state.businessOutcomes || undefined,
            seedKeywords: state.seedKeywords.length > 0 ? state.seedKeywords : undefined,
            competitorDomains: state.competitorDomains.length > 0 ? state.competitorDomains : undefined,
            sessionToken: state.sessionId ?? undefined,
          }),
        });

        clearInterval(stageTimer);

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "Setup failed" }));
          throw new Error(err.error || "Setup failed");
        }

        const result: SetupResult = await response.json();
        set({ setupResult: result, setupStage: "done", isSettingUp: false, step: 7 });
      } catch (err) {
        clearInterval(stageTimer);
        set({
          setupError: err instanceof Error ? err.message : "Something went wrong",
          isSettingUp: false,
        });
      }
    },

    reset: () => set(initialState),
  }),
);
