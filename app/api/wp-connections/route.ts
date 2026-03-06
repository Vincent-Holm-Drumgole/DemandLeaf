import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { encryptCredentials } from "@/lib/publishing/credentials";
import { WpClient } from "@/lib/publishing/wp-client";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const connections = await convex.query(api.wpConnections.listByWorkspace, {
    workspaceId: workspace._id,
  });

  // Strip encrypted credential data from response
  return NextResponse.json(
    connections.map((c) => ({
      id: c._id,
      siteUrl: c.siteUrl,
      authMethod: c.authMethod,
      pluginDetected: c.pluginDetected ?? null,
      status: c.status,
      lastTestedAt: c.lastTestedAt ?? null,
    }))
  );
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await checkRateLimit(`wp-connect:${userId}`, {
    limit: 10,
    windowSec: 60,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Rate limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000))
          ),
        },
      }
    );
  }

  let body: {
    siteUrl?: string;
    username?: string;
    appPassword?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.siteUrl || !body.username || !body.appPassword) {
    return NextResponse.json(
      { error: "siteUrl, username, and appPassword are required" },
      { status: 400 }
    );
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Encrypt credentials before storing
  const credentialJson = JSON.stringify({
    username: body.username,
    appPassword: body.appPassword,
  });
  const { encrypted, iv, tag } = encryptCredentials(credentialJson);

  const connectionId = await convex.mutation(api.wpConnections.create, {
    workspaceId: workspace._id,
    siteUrl: body.siteUrl,
    authMethod: "application_password",
    encryptedCredentials: encrypted,
    credentialIv: iv,
    credentialTag: tag,
  });

  // Test connection and detect plugins
  try {
    const client = new WpClient(body.siteUrl, {
      username: body.username,
      appPassword: body.appPassword,
    });
    await client.testConnection();
    const plugins = await client.detectSeoPlugins();
    const pluginDetected = plugins.rankmath
      ? ("rankmath" as const)
      : plugins.yoast
        ? ("yoast" as const)
        : ("none" as const);

    await convex.mutation(api.wpConnections.updateStatus, {
      connectionId,
      status: "connected",
      pluginDetected,
    });

    return NextResponse.json({
      id: connectionId,
      siteUrl: body.siteUrl,
      status: "connected",
      pluginDetected,
    });
  } catch (err) {
    await convex.mutation(api.wpConnections.updateStatus, {
      connectionId,
      status: "error",
    });
    return NextResponse.json(
      {
        id: connectionId,
        siteUrl: body.siteUrl,
        status: "error",
        error: err instanceof Error ? err.message : "Connection test failed",
      },
      { status: 502 }
    );
  }
}
