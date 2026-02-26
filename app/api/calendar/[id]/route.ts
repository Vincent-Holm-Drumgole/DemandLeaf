import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_UNAUTHORIZED } from "@/convex/errors";
import { hasConvexErrorCode } from "@/lib/convex-error";

const VALID_STATUSES = ["scheduled", "in_progress", "completed", "skipped"] as const;
type CalendarStatus = (typeof VALID_STATUSES)[number];

// PUT /api/calendar/[id] — reschedule or update status of a calendar item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`calendar-update:${userId}`, { limit: 60, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await params;
  const calendarId = parseConvexId(id, "contentCalendar");
  if (!calendarId) return NextResponse.json({ error: "Invalid calendar item id" }, { status: 400 });

  let body: { scheduledDate?: number; priority?: number; status?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.scheduledDate === undefined && body.priority === undefined && body.status === undefined) {
    return NextResponse.json({ error: "At least one of scheduledDate, priority, or status is required" }, { status: 400 });
  }
  if (body.scheduledDate !== undefined && (!Number.isFinite(body.scheduledDate) || body.scheduledDate <= 0)) {
    return NextResponse.json({ error: "scheduledDate must be a valid epoch timestamp" }, { status: 400 });
  }
  if (body.priority !== undefined && (!Number.isFinite(body.priority) || body.priority < 1)) {
    return NextResponse.json({ error: "priority must be a positive number" }, { status: 400 });
  }

  if (
    body.status !== undefined &&
    (typeof body.status !== "string" || !VALID_STATUSES.includes(body.status as CalendarStatus))
  ) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  try {
    const convex = await getAuthedConvexClient();

    await convex.mutation(api.contentCalendar.update, {
      calendarId,
      scheduledDate: body.scheduledDate,
      priority: body.priority,
      status: body.status as CalendarStatus | undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Calendar item not found")) {
      return NextResponse.json({ error: "Calendar item not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[calendar/[id]/PUT] error:", err);
    return NextResponse.json({ error: "Failed to update calendar item" }, { status: 500 });
  }
}
