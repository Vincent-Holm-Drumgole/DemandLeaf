import { create } from "zustand";
import type { CrawlResponse } from "@/types";

export type WizardStep = 1 | 2 | 3 | 4 | 5;

interface OnboardingWizardState {
  step: WizardStep;
  workspaceName: string;
  url: string;
  sessionId: string | null;
  crawlResult: CrawlResponse | null;
  crawlError: string | null;
  isCrawling: boolean;
  isProvisioning: boolean;
  provisionError: string | null;
  skippedUrl: boolean;

  setStep: (step: WizardStep) => void;
  setWorkspaceName: (name: string) => void;
  setUrl: (url: string) => void;
  updateCrawlResult: (fields: Partial<CrawlResponse>) => void;
  startCrawl: () => Promise<void>;
  provision: () => Promise<boolean>;
  reset: () => void;
}

const initialState = {
  step: 1 as WizardStep,
  workspaceName: "My Workspace",
  url: "",
  sessionId: null as string | null,
  crawlResult: null as CrawlResponse | null,
  crawlError: null as string | null,
  isCrawling: false,
  isProvisioning: false,
  provisionError: null as string | null,
  skippedUrl: false,
};

export const useOnboardingWizardStore = create<OnboardingWizardState>(
  (set, get) => ({
    ...initialState,

    setStep: (step) => set({ step }),
    setWorkspaceName: (workspaceName) => set({ workspaceName }),
    setUrl: (url) => set({ url }),

    updateCrawlResult: (fields) =>
      set((state) => ({
        crawlResult: state.crawlResult
          ? { ...state.crawlResult, ...fields }
          : null,
      })),

    startCrawl: async () => {
      const { url } = get();
      set({ isCrawling: true, crawlError: null, step: 3 });

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
          let errorMessage = "Failed to analyze your website";
          try {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
          } catch {
            // not JSON
          }
          throw new Error(errorMessage);
        }

        const data: CrawlResponse = await response.json();
        set({
          sessionId: data.sessionId,
          crawlResult: data,
          isCrawling: false,
          step: 4,
          workspaceName: data.companyName || get().workspaceName,
        });
      } catch (err) {
        set({
          crawlError:
            err instanceof Error ? err.message : "Something went wrong",
          isCrawling: false,
          step: 2,
        });
      }
    },

    provision: async () => {
      const { workspaceName, sessionId } = get();
      set({ isProvisioning: true, provisionError: null });

      try {
        const response = await fetch("/api/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workspaceName.trim() || "My Workspace",
            sessionId: sessionId ?? undefined,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to set up workspace");
        }

        set({ isProvisioning: false });
        return true;
      } catch (err) {
        set({
          provisionError:
            err instanceof Error ? err.message : "Something went wrong",
          isProvisioning: false,
        });
        return false;
      }
    },

    reset: () => set(initialState),
  }),
);
