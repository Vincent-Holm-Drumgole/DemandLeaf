import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import type { FunctionReturnType } from "convex/server";

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const entries: FunctionReturnType<typeof api.neverSayList.listByWorkspace> =
      await convex.query(api.neverSayList.listByWorkspace, {
        workspaceId: workspace._id,
      });
    const items = entries.map((entry) => ({
      _id: entry._id,
      term: entry.term,
      termType: entry.termType,
      addedAt: entry.addedAt,
    }));
    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[never-say/GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch list" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`never-say:${userId}`, { limit: 30, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  let body: { term?: string; termType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { term, termType } = body;

  if (!term || typeof term !== "string" || term.trim().length === 0) {
    return NextResponse.json({ error: "term is required" }, { status: 400 });
  }
  if (term.length > 50) {
    return NextResponse.json({ error: "term must be 50 characters or less" }, { status: 400 });
  }
  const normalizedTermType =
    termType === "word" || termType === "phrase" ? termType : undefined;
  if (!normalizedTermType) {
    return NextResponse.json({ error: "termType must be 'word' or 'phrase'" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const id = await convex.mutation(api.neverSayList.add, {
      workspaceId: workspace._id,
      term: term.trim(),
      termType: normalizedTermType,
    });
    return NextResponse.json(
      {
        item: {
          _id: id,
          term: term.trim(),
          termType: normalizedTermType,
        },
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add term";
    if (message.includes("limit reached") || message.includes("already exists")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[never-say/POST] error:", err);
    return NextResponse.json({ error: "Failed to add term" }, { status: 500 });
  }
}
