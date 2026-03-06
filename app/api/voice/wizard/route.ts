import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import type { SourceQuality, VoiceProfile } from "@/types";
import { checkRateLimit } from "@/lib/rate-limit";
import type {
  WizardStep1Answers,
  WizardStep2Answers,
} from "@/lib/voice/wizard-translator";
import { translateWizardToProfile } from "@/lib/voice/wizard-translator";

type VoiceWizardPatch = FunctionArgs<typeof api.voiceProfiles.updateFromWizard>["patch"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`voice-wizard:${userId}`, { limit: 30, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  let body: {
    step?: unknown;
    step1?: unknown;
    step2?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.step !== 1 && body.step !== 2 && body.step !== 3) {
    return NextResponse.json({ error: "step must be 1, 2, or 3" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Only patch the voice profile when both step 1 and step 2 answers are provided (step 3 completes the wizard)
  if (body.step === 3) {
    const step1 = parseWizardStep1Answers(body.step1);
    const step2 = parseWizardStep2Answers(body.step2);
    if (!step1 || !step2) {
      return NextResponse.json({ error: "step1 and step2 answers required for final step" }, { status: 400 });
    }

    // Get or create voice profile
    const voiceProfile = await convex.query(api.voiceProfiles.getByWorkspace, {
      workspaceId: workspace._id,
    });

    const existingProfile: Partial<VoiceProfile> = voiceProfile
      ? {
          preferredVocabulary: voiceProfile.vocabularyPreferences?.preferred ?? [],
          avoidedVocabulary: voiceProfile.vocabularyPreferences?.avoid ?? [],
          writingExamples: voiceProfile.writingExamples ?? [],
          sourceQuality: normalizeSourceQuality(voiceProfile.sourceQuality) ?? "none",
        }
      : {};

    const translated = translateWizardToProfile(step1, step2, existingProfile);
    const patch: VoiceWizardPatch = {
      voiceDescription: translated.voiceDescription ?? "Professional and clear",
      formality: translated.formality ?? 5,
      humor: translated.humor ?? 5,
      jargonLevel: translated.jargonLevel ?? 5,
      sentenceComplexity: translated.sentenceComplexity ?? 5,
      toneAttributes: translated.toneAttributes ?? [],
      preferredVocabulary: translated.preferredVocabulary ?? [],
      avoidedVocabulary: translated.avoidedVocabulary ?? [],
      writingExamples: translated.writingExamples ?? [],
      sourceQuality: translated.sourceQuality ?? "none",
      thoughtLeadershipPositions: translated.thoughtLeadershipPositions,
      brandPhilosophy: translated.brandPhilosophy,
    };

    try {
      await convex.mutation(api.voiceProfiles.updateFromWizard, {
        workspaceId: workspace._id,
        patch,
      });
    } catch (err) {
      console.error("[voice/wizard] mutation error:", err);
      return NextResponse.json({ error: "Failed to update voice profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, wizardCompleted: true });
  }

  // Steps 1 and 2 are just acknowledged — client stores answers in Zustand
  return NextResponse.json({ success: true, step: body.step });
}

function normalizeSourceQuality(value: unknown): SourceQuality | undefined {
  if (
    value === "strong" ||
    value === "mixed" ||
    value === "limited" ||
    value === "none"
  ) {
    return value;
  }
  return undefined;
}

function parseWizardStep1Answers(value: unknown): WizardStep1Answers | null {
  if (!isObject(value)) return null;
  const dinnerPartyDescription =
    typeof value.dinnerPartyDescription === "string" ? value.dinnerPartyDescription.trim() : "";
  const brandsAdmired = parseStringArray(value.brandsAdmired, 3, 120);
  const nonNegotiables = parseStringArray(value.nonNegotiables, 10, 60);
  const brandPersonalityWords = parseStringArray(value.brandPersonalityWords, 10, 80);

  if (!dinnerPartyDescription || brandsAdmired.length === 0 || brandPersonalityWords.length === 0) {
    return null;
  }

  return {
    dinnerPartyDescription,
    brandsAdmired,
    nonNegotiables,
    brandPersonalityWords,
  };
}

function parseWizardStep2Answers(value: unknown): WizardStep2Answers | null {
  if (!isObject(value)) return null;

  const formality = parseSliderValue(value.formality);
  const humor = parseSliderValue(value.humor);
  const jargonLevel = parseSliderValue(value.jargonLevel);
  const sentenceComplexity = parseSliderValue(value.sentenceComplexity);
  const thoughtLeadershipPositions = parseStringArray(value.thoughtLeadershipPositions, 8, 300);
  const brandPhilosophy =
    typeof value.brandPhilosophy === "string" ? value.brandPhilosophy.trim().slice(0, 1500) : "";

  if (
    formality === null ||
    humor === null ||
    jargonLevel === null ||
    sentenceComplexity === null ||
    !brandPhilosophy
  ) {
    return null;
  }

  return {
    formality,
    humor,
    jargonLevel,
    sentenceComplexity,
    thoughtLeadershipPositions,
    brandPhilosophy,
  };
}

function parseSliderValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 10) return null;
  return rounded;
}

function parseStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= maxLength)
    .slice(0, maxItems);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
