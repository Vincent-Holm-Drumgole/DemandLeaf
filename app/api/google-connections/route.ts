import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const conn = await convex.query(api.googleConnections.getByWorkspace, {
    workspaceId: workspace._id,
  });

  if (!conn) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    id: conn._id,
    ga4PropertyId: conn.ga4PropertyId ?? null,
    gscSiteUrl: conn.gscSiteUrl ?? null,
    status: conn.status,
    lastSyncedAt: conn.lastSyncedAt ?? null,
  });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ga4PropertyId?: string; gscSiteUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    (body.ga4PropertyId !== undefined && typeof body.ga4PropertyId !== "string") ||
    (body.gscSiteUrl !== undefined && typeof body.gscSiteUrl !== "string")
  ) {
    return NextResponse.json({ error: "Invalid field types" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const conn = await convex.query(api.googleConnections.getByWorkspace, {
    workspaceId: workspace._id,
  });
  if (!conn) {
    return NextResponse.json({ error: "No Google connection" }, { status: 404 });
  }

  await convex.mutation(api.googleConnections.updateProperties, {
    connectionId: conn._id,
    ...body,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const conn = await convex.query(api.googleConnections.getByWorkspace, {
    workspaceId: workspace._id,
  });
  if (!conn) {
    return NextResponse.json({ error: "No Google connection" }, { status: 404 });
  }

  await convex.mutation(api.googleConnections.remove, {
    connectionId: conn._id,
  });

  return NextResponse.json({ success: true });
}
