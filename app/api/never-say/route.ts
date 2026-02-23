import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const entries = await convex.query(api.neverSayList.listByWorkspace, {
      workspaceId: workspace._id,
    });
    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e._id,
        term: e.term,
        termType: e.termType,
        addedAt: new Date(e.addedAt).toISOString(),
      })),
    });
  } catch (err) {
    console.error("[never-say/GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch list" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  if (!termType || !["word", "phrase"].includes(termType)) {
    return NextResponse.json({ error: "termType must be 'word' or 'phrase'" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    const id = await convex.mutation(api.neverSayList.add, {
      workspaceId: workspace._id,
      term: term.trim(),
      termType,
    });
    return NextResponse.json({ id, term: term.trim(), termType }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add term";
    if (message.includes("limit reached") || message.includes("already exists")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    console.error("[never-say/POST] error:", err);
    return NextResponse.json({ error: "Failed to add term" }, { status: 500 });
  }
}
