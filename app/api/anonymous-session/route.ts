import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

interface AnonymousSessionRequest {
  crawlData?: unknown;
  voiceProfile?: unknown;
  expiresInHours?: number;
}

const DEFAULT_TTL_HOURS = 24;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`anon-session:${ip}`, { limit: 20, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  let body: AnonymousSessionRequest = {};
  try {
    body = (await request.json()) as AnonymousSessionRequest;
  } catch {
    // Empty body is valid.
  }

  const sessionToken = randomUUID();
  const expiresInHours =
    typeof body.expiresInHours === "number" && body.expiresInHours > 0
      ? body.expiresInHours
      : DEFAULT_TTL_HOURS;
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;

  try {
    const convex = getConvexClient();
    await convex.mutation(api.anonymousSessions.create, {
      sessionToken,
      crawlData: body.crawlData,
      voiceProfile: body.voiceProfile,
      expiresAt,
    });

    return NextResponse.json(
      { sessionId: sessionToken, expiresAt: new Date(expiresAt).toISOString() },
      { status: 201 }
    );
  } catch (err) {
    console.error("[anonymous-session] mutation error:", err);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
