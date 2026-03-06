import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  _request: Request,
  context: { params: Promise<{ alertId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`decay-alert:get:${userId}`, {
    limit: 60,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } }
    );
  }

  const { alertId: rawId } = await context.params;
  const alertId = parseConvexId(rawId, "decayAlerts");
  if (!alertId) {
    return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace required" }, { status: 403 });
  }

  const alert = await convex.query(api.decayAlerts.getById, { alertId });
  if (!alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const blog = await convex.query(api.blogs.getById, { blogId: alert.blogId });

  return NextResponse.json({
    id: alert._id,
    blogId: alert.blogId,
    blogTitle: blog?.title ?? "Unknown",
    blogUrl: blog?.wpPostUrl ?? null,
    alertType: alert.alertType,
    severity: alert.severity,
    triggeredAt: alert.triggeredAt,
    status: alert.status,
    baselineValue: alert.baselineValue,
    currentValue: alert.currentValue,
    deltaPercent: alert.deltaPercent,
    diagnosisCause: alert.diagnosisCause ?? null,
    diagnosisNotes: alert.diagnosisNotes ?? null,
    escalatedAt: alert.escalatedAt ?? null,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ alertId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`decay-alert:patch:${userId}`, {
    limit: 30,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))) } }
    );
  }

  const { alertId: rawId } = await context.params;
  const alertId = parseConvexId(rawId, "decayAlerts");
  if (!alertId) {
    return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  }

  let body: { action: "acknowledge" | "escalate" | "resolve" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const statusMap = {
    acknowledge: "acknowledged" as const,
    escalate: "escalated" as const,
    resolve: "resolved" as const,
  };

  const newStatus = statusMap[body.action];
  if (!newStatus) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace required" }, { status: 403 });
  }

  try {
    await convex.mutation(api.decayAlerts.updateStatus, {
      alertId,
      status: newStatus,
    });
    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    console.error("[decay-alerts/PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
