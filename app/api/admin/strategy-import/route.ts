import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { executeStrategyImport, type ImportPayload } from "@/lib/strategy/import";

export const maxDuration = 300;

function getSessionRole(sessionClaims: unknown): string | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") return undefined;
  const metadata = "metadata" in sessionClaims
    ? (sessionClaims as { metadata?: unknown }).metadata
    : undefined;
  if (!metadata || typeof metadata !== "object") return undefined;
  const role = "role" in metadata ? (metadata as { role?: unknown }).role : undefined;
  return typeof role === "string" ? role : undefined;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (getSessionRole(sessionClaims) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ImportPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.strategyName || !body.seedKeywords?.length) {
    return NextResponse.json({ error: "strategyName and seedKeywords are required" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const { results } = await executeStrategyImport(convex, workspace._id, body);
    return NextResponse.json({ success: true, results }, { status: 200 });
  } catch (err) {
    console.error("[admin/strategy-import] error:", err);
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
