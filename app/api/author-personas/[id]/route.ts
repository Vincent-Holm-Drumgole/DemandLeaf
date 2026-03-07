import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(raw)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const body: {
    name?: string;
    jobTitle?: string;
    bio?: string;
    socialUrls?: { twitter?: string; linkedin?: string; website?: string };
    expertiseAreas?: string[];
    wpAuthorId?: number;
    isDefault?: boolean;
  } = {};

  if (raw.name !== undefined) {
    if (typeof raw.name !== "string") {
      return NextResponse.json({ error: "name must be a string" }, { status: 400 });
    }
    body.name = raw.name;
  }
  if (raw.jobTitle !== undefined) {
    if (typeof raw.jobTitle !== "string") {
      return NextResponse.json({ error: "jobTitle must be a string" }, { status: 400 });
    }
    body.jobTitle = raw.jobTitle;
  }
  if (raw.bio !== undefined) {
    if (typeof raw.bio !== "string") {
      return NextResponse.json({ error: "bio must be a string" }, { status: 400 });
    }
    body.bio = raw.bio;
  }
  if (raw.socialUrls !== undefined) {
    if (!isRecord(raw.socialUrls)) {
      return NextResponse.json({ error: "socialUrls must be an object" }, { status: 400 });
    }
    const { twitter, linkedin, website } = raw.socialUrls;
    if (
      (twitter !== undefined && typeof twitter !== "string") ||
      (linkedin !== undefined && typeof linkedin !== "string") ||
      (website !== undefined && typeof website !== "string")
    ) {
      return NextResponse.json(
        { error: "socialUrls values must be strings" },
        { status: 400 }
      );
    }
    body.socialUrls = {
      ...(typeof twitter === "string" && { twitter }),
      ...(typeof linkedin === "string" && { linkedin }),
      ...(typeof website === "string" && { website }),
    };
  }
  if (raw.expertiseAreas !== undefined) {
    if (
      !Array.isArray(raw.expertiseAreas) ||
      raw.expertiseAreas.some((item) => typeof item !== "string")
    ) {
      return NextResponse.json(
        { error: "expertiseAreas must be an array of strings" },
        { status: 400 }
      );
    }
    body.expertiseAreas = raw.expertiseAreas;
  }
  if (raw.wpAuthorId !== undefined) {
    if (typeof raw.wpAuthorId !== "number" || !Number.isFinite(raw.wpAuthorId)) {
      return NextResponse.json(
        { error: "wpAuthorId must be a number" },
        { status: 400 }
      );
    }
    body.wpAuthorId = raw.wpAuthorId;
  }
  if (raw.isDefault !== undefined) {
    if (typeof raw.isDefault !== "boolean") {
      return NextResponse.json(
        { error: "isDefault must be a boolean" },
        { status: 400 }
      );
    }
    body.isDefault = raw.isDefault;
  }
  if (Object.keys(body).length === 0) {
    return NextResponse.json(
      { error: "At least one valid field is required" },
      { status: 400 }
    );
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

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

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    await convex.mutation(api.authorPersonas.remove, { personaId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[author-personas/DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
