import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const personaId = parseConvexId(id, "authorPersonas");
  if (!personaId) {
    return NextResponse.json({ error: "Invalid persona ID" }, { status: 400 });
  }

  const body = (await request.json()) as {
    name?: string;
    jobTitle?: string;
    bio?: string;
    socialUrls?: { twitter?: string; linkedin?: string; website?: string };
    expertiseAreas?: string[];
    wpAuthorId?: number;
    isDefault?: boolean;
  };

  const convex = await getAuthedConvexClient();

  try {
    await convex.mutation(api.authorPersonas.update, {
      personaId,
      ...body,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[author-personas/PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const personaId = parseConvexId(id, "authorPersonas");
  if (!personaId) {
    return NextResponse.json({ error: "Invalid persona ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();

  try {
    await convex.mutation(api.authorPersonas.remove, { personaId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[author-personas/DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
