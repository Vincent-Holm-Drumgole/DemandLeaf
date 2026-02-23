import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import type { SourceQuality, VoiceProfile } from "@/types";
import type {
  WizardStep1Answers,
  WizardStep2Answers,
} from "@/lib/voice/wizard-translator";
import { translateWizardToProfile } from "@/lib/voice/wizard-translator";

type VoiceWizardPatch = FunctionArgs<typeof api.voiceProfiles.updateFromWizard>["patch"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    step: 1 | 2 | 3;
    step1?: WizardStep1Answers;
    step2?: WizardStep2Answers;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.step || ![1, 2, 3].includes(body.step)) {
    return NextResponse.json({ error: "step must be 1, 2, or 3" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Only patch the voice profile when both step 1 and step 2 answers are provided (step 3 completes the wizard)
  if (body.step === 3) {
    if (!body.step1 || !body.step2) {
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

    const translated = translateWizardToProfile(body.step1, body.step2, existingProfile);
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
