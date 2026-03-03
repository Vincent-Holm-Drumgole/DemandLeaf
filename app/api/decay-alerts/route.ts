import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`decay-alerts:${userId}`, {
    limit: 60,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const alerts = await convex.query(api.decayAlerts.listByWorkspace, {
    workspaceId: workspace._id,
  });

  return NextResponse.json(
    alerts.map(
      (a: {
        _id: string;
        blogId: string;
        alertType: string;
        severity: string;
        triggeredAt: number;
        status: string;
        baselineValue: number;
        currentValue: number;
        deltaPercent: number;
        diagnosisCause?: string;
        diagnosisNotes?: string;
      }) => ({
        id: a._id,
        blogId: a.blogId,
        alertType: a.alertType,
        severity: a.severity,
        triggeredAt: a.triggeredAt,
        status: a.status,
        baselineValue: a.baselineValue,
        currentValue: a.currentValue,
        deltaPercent: a.deltaPercent,
        diagnosisCause: a.diagnosisCause ?? null,
        diagnosisNotes: a.diagnosisNotes ?? null,
      })
    )
  );
}
