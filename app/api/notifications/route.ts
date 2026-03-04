import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";

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

  const notifications = await convex.query(api.notifications.listByWorkspace, {
    workspaceId: workspace._id,
  });

  const unreadCount = await convex.query(api.notifications.getUnreadCount, {
    workspaceId: workspace._id,
  });

  return NextResponse.json({
    notifications: notifications.map(
      (n: {
        _id: string;
        type: string;
        agentType: string;
        agentActionId?: string;
        title: string;
        body: string;
        read: boolean;
        createdAt: number;
      }) => ({
        id: n._id,
        type: n.type,
        agentType: n.agentType,
        agentActionId: n.agentActionId ?? null,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.createdAt,
      })
    ),
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { notificationId?: string; markAllRead?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (body.markAllRead) {
    await convex.mutation(api.notifications.markAllRead, {
      workspaceId: workspace._id,
    });
    return NextResponse.json({ success: true });
  }

  if (body.notificationId) {
    const notifId = parseConvexId(body.notificationId, "notifications");
    if (!notifId) {
      return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
    }
    await convex.mutation(api.notifications.markRead, {
      notificationId: notifId,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Missing action" }, { status: 400 });
}
