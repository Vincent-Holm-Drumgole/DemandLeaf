import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { decryptCredentials } from "@/lib/publishing/credentials";
import { WpClient } from "@/lib/publishing/wp-client";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const connectionId = parseConvexId(id, "wpConnections");
  if (!connectionId) {
    return NextResponse.json({ error: "Invalid connection ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const conn = await convex.query(api.wpConnections.getById, { connectionId });
  if (!conn) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    const credJson = decryptCredentials(
      conn.encryptedCredentials,
      conn.credentialIv,
      conn.credentialTag
    );
    const creds = JSON.parse(credJson) as {
      username: string;
      appPassword: string;
    };

    const client = new WpClient(conn.siteUrl, creds);
    const { siteName } = await client.testConnection();
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
      status: "connected",
      siteName,
      pluginDetected,
    });
  } catch (err) {
    try {
      await convex.mutation(api.wpConnections.updateStatus, {
        connectionId,
        status: "error",
      });
    } catch (mutationErr) {
      console.error("[wp-test] Failed to update connection status:", mutationErr);
    }
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : "Connection test failed",
      },
      { status: 502 }
    );
  }
}
