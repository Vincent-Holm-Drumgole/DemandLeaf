import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";

interface CalibrationRating {
  text: string;
  rating: number;
  feedback?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`voice-calibration-rate:${userId}`, {
    limit: 30,
    windowSec: 3600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  let body: { samples?: CalibrationRating[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const samples = body.samples;
  if (!Array.isArray(samples) || samples.length === 0) {
    return NextResponse.json({ error: "samples array required" }, { status: 400 });
  }
  if (samples.length > 10) {
    return NextResponse.json({ error: "At most 10 samples may be rated at once" }, { status: 400 });
  }

  // Validate ratings
  for (const s of samples) {
    if (typeof s.text !== "string" || s.text.trim().length === 0) {
      return NextResponse.json({ error: "Each sample must have non-empty text" }, { status: 400 });
    }
    if (s.text.length > 4000) {
      return NextResponse.json({ error: "Each sample text must be 4000 characters or less" }, { status: 400 });
    }
    if (typeof s.rating !== "number" || s.rating < 1 || s.rating > 10) {
      return NextResponse.json({ error: "Each sample must have a rating between 1 and 10" }, { status: 400 });
    }
    if (s.feedback !== undefined && (typeof s.feedback !== "string" || s.feedback.length > 1000)) {
      return NextResponse.json({ error: "feedback must be a string up to 1000 characters" }, { status: 400 });
    }
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const voiceProfile = await convex.query(api.voiceProfiles.getByWorkspace, {
    workspaceId: workspace._id,
  });

  if (!voiceProfile) {
    return NextResponse.json({ error: "Voice profile not found" }, { status: 422 });
  }

  let addedToExamples = 0;
  let successCount = 0;
  for (const sample of samples) {
    try {
      await convex.mutation(api.calibration.recordRating, {
        workspaceId: workspace._id,
        voiceProfileId: voiceProfile._id,
        sampleParagraph: sample.text.trim(),
        rating: sample.rating,
        feedback: sample.feedback?.trim() || undefined,
      });
      successCount++;
      if (sample.rating >= 8) addedToExamples++;
    } catch (err) {
      console.error("[voice/calibration/rate] record error:", err);
    }
  }

  if (successCount === 0) {
    return NextResponse.json({ error: "Failed to record any ratings" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ratingsRecorded: successCount,
    addedToExamples,
  });
}
