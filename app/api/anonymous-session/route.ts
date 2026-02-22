import { NextRequest, NextResponse } from "next/server";
import { createAnonymousSession } from "@/lib/session-store";

interface AnonymousSessionRequest {
  crawlData?: unknown;
  voiceProfile?: unknown;
  blogData?: unknown;
  expiresInHours?: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: AnonymousSessionRequest = {};
  try {
    body = (await request.json()) as AnonymousSessionRequest;
  } catch {
    // Empty body is valid; we'll create a session shell.
  }

  const { sessionToken, expiresAt } = await createAnonymousSession({
    crawlData: body.crawlData,
    voiceProfile: body.voiceProfile,
    blogData: body.blogData,
    expiresInHours:
      typeof body.expiresInHours === "number" && body.expiresInHours > 0
        ? body.expiresInHours
        : undefined,
  });

  return NextResponse.json(
    {
      sessionId: sessionToken,
      expiresAt,
    },
    { status: 201 }
  );
}
