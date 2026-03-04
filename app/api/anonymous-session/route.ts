import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import type { FunctionArgs } from "convex/server";

type CreateAnonymousSessionArgs = FunctionArgs<typeof api.anonymousSessions.create>;

interface AnonymousSessionRequest {
  crawlData?: CreateAnonymousSessionArgs["crawlData"];
  voiceProfile?: CreateAnonymousSessionArgs["voiceProfile"];
  expiresInHours?: number;
}

const DEFAULT_TTL_HOURS = 24;
const MAX_TTL_HOURS = 24;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`anon-session:${ip}`, { limit: 20, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) },
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
    typeof body.expiresInHours === "number" && Number.isFinite(body.expiresInHours)
      ? Math.min(Math.max(Math.floor(body.expiresInHours), 1), MAX_TTL_HOURS)
      : DEFAULT_TTL_HOURS;
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const maxAge = Math.floor((expiresAt - Date.now()) / 1000);

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
      {
        status: 201,
        headers: {
          "Set-Cookie": `dl_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}; Max-Age=${maxAge}`,
        },
      }
    );
  } catch (err) {
    console.error("[anonymous-session] mutation error:", err);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
