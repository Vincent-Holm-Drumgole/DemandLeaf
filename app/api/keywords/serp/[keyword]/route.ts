import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSerpResults } from "@/lib/seo-data";

interface RouteParams {
  params: Promise<{ keyword: string }>;
}

export async function GET(_request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`keywords-serp:${userId}`, { limit: 30, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { keyword } = await context.params;
  let decoded = "";
  try {
    decoded = decodeURIComponent(keyword).trim();
  } catch {
    return NextResponse.json({ error: "Invalid keyword encoding" }, { status: 400 });
  }
  if (!decoded) return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  if (decoded.length > 120) {
    return NextResponse.json({ error: "keyword must be 120 characters or fewer" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const results = await getSerpResults(convex, decoded);
    return NextResponse.json({ keyword: decoded, results });
  } catch (err) {
    console.error("[keywords/serp/GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch SERP results" }, { status: 500 });
  }
}
