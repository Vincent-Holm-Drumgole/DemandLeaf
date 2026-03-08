import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const entryId = parseConvexId(id, "knowledgeBase");
  if (!entryId) {
    return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const versions = await convex.query(api.knowledgeBase.listVersions, {
    entryId,
    workspaceId: workspace._id,
  });

  return NextResponse.json({
    versions: versions.map((version) => ({
      id: version._id,
      title: version.title,
      content: version.content,
      entryType: version.entryType,
      tags: version.tags,
      capabilityStatus: version.capabilityStatus,
      discoveryNotes: version.discoveryNotes ?? undefined,
      lastVerifiedAt: version.lastVerifiedAt ?? undefined,
      createdAt: version.createdAt,
    })),
  });
}
