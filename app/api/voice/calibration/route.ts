import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { callSonnet, parseJsonResponse } from "@/lib/ai/client";
import { buildCalibrationSamplesPrompt } from "@/lib/ai/prompts/voiceCalibration";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { topic?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Get voice profile
  const voiceProfile = await convex.query(api.voiceProfiles.getByWorkspace, {
    workspaceId: workspace._id,
  });

  if (!voiceProfile) {
    return NextResponse.json({ error: "Voice profile not found. Complete the voice wizard first." }, { status: 422 });
  }

  // Build the voice profile shape for the prompt
  const profile = {
    voiceDescription: voiceProfile.voiceDescription,
    formality: voiceProfile.voiceAttributes.formality,
    humor: voiceProfile.voiceAttributes.humor,
    jargonLevel: voiceProfile.voiceAttributes.jargonLevel,
    sentenceComplexity: voiceProfile.voiceAttributes.sentenceComplexity,
    toneAttributes: voiceProfile.voiceAttributes.toneAttributes,
    preferredVocabulary: voiceProfile.vocabularyPreferences?.preferred ?? [],
    avoidedVocabulary: voiceProfile.vocabularyPreferences?.avoid ?? [],
    writingExamples: voiceProfile.writingExamples,
    sourceQuality: (voiceProfile.sourceQuality ?? "none") as "strong" | "mixed" | "limited" | "none",
  };

  const { systemPrompt, userMessage } = buildCalibrationSamplesPrompt(
    profile,
    body.topic ?? `${workspace.industry ?? "your industry"} content strategy`
  );

  try {
    const result = await callSonnet(systemPrompt, userMessage, {
      maxTokens: 1024,
      temperature: 0.7,
    });
    const parsed = parseJsonResponse<{ samples: Array<{ id: number; variant: string; text: string }> }>(result.content);
    return NextResponse.json({ samples: parsed.samples });
  } catch (err) {
    console.error("[voice/calibration] generation error:", err);
    return NextResponse.json({ error: "Failed to generate calibration samples" }, { status: 500 });
  }
}
