import { create } from "zustand";
import type { WizardStep1Answers, WizardStep2Answers } from "@/lib/voice/wizard-translator";

export interface CalibrationSample {
  id: number;
  variant: string;
  text: string;
}

export interface CalibrationRating {
  text: string;
  rating: number;
  feedback?: string;
}

interface VoiceWizardState {
  currentStep: 1 | 2 | 3;
  step1Answers: WizardStep1Answers | null;
  step2Answers: WizardStep2Answers | null;
  calibrationSamples: CalibrationSample[] | null;
  isLoading: boolean;
  error: string | null;
  wizardCompleted: boolean;

  setStep: (step: 1 | 2 | 3) => void;
  saveStep1: (answers: WizardStep1Answers) => void;
  saveStep2: (answers: WizardStep2Answers) => void;
  loadCalibrationSamples: (topic?: string) => Promise<void>;
  submitRatings: (ratings: CalibrationRating[]) => Promise<void>;
  completeWizard: () => Promise<void>;
  reset: () => void;
}

export const useVoiceWizardStore = create<VoiceWizardState>((set, get) => ({
  currentStep: 1,
  step1Answers: null,
  step2Answers: null,
  calibrationSamples: null,
  isLoading: false,
  error: null,
  wizardCompleted: false,

  setStep: (step) => set({ currentStep: step }),

  saveStep1: (answers) => set({ step1Answers: answers, currentStep: 2 }),

  saveStep2: (answers) => set({ step2Answers: answers, currentStep: 3 }),

  loadCalibrationSamples: async (topic) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/voice/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) {
        let errorMsg = "Failed to generate samples";
        try {
          const data = await res.json();
          errorMsg = data.error ?? errorMsg;
        } catch {
          // Response wasn't JSON, use default message
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      set({ calibrationSamples: data.samples, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to generate samples",
        isLoading: false,
      });
    }
  },

  submitRatings: async (ratings) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/voice/calibration/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: ratings }),
      });
      if (!res.ok) {
        let errorMsg = "Failed to submit ratings";
        try {
          const data = await res.json();
          errorMsg = data.error ?? errorMsg;
        } catch {
          // Response wasn't JSON, use default message
        }
        throw new Error(errorMsg);
      }
      set({ isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to submit ratings",
        isLoading: false,
      });
    }
  },

  completeWizard: async () => {
    const { step1Answers, step2Answers } = get();
    if (!step1Answers || !step2Answers) {
      set({ error: "Complete steps 1 and 2 before finishing" });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/voice/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 3, step1: step1Answers, step2: step2Answers }),
      });
      if (!res.ok) {
        let errorMsg = "Failed to save voice profile";
        try {
          const data = await res.json();
          errorMsg = data.error ?? errorMsg;
        } catch {
          // Response wasn't JSON, use default message
        }
        throw new Error(errorMsg);
      }
      set({ wizardCompleted: true, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to save voice profile",
        isLoading: false,
      });
    }
  },

  reset: () =>
    set({
      currentStep: 1,
      step1Answers: null,
      step2Answers: null,
      calibrationSamples: null,
      isLoading: false,
      error: null,
      wizardCompleted: false,
    }),
}));
