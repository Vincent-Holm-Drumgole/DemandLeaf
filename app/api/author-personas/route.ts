import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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

  try {
    const personas = await convex.query(api.authorPersonas.listByWorkspace, {
      workspaceId: workspace._id,
    });

    return NextResponse.json(
      personas.map((p) => ({
        id: p._id,
        name: p.name,
        jobTitle: p.jobTitle ?? null,
        bio: p.bio ?? null,
        socialUrls: p.socialUrls ?? null,
        expertiseAreas: p.expertiseAreas,
        avatarUrl: p.avatarUrl ?? null,
        wpAuthorId: p.wpAuthorId ?? null,
        isDefault: p.isDefault,
      }))
    );
  } catch (err) {
    console.error("[author-personas/GET]", err);
    return NextResponse.json(
      { error: "Failed to load author personas" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(rawBody)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, jobTitle, bio, socialUrls, expertiseAreas, wpAuthorId, isDefault } = rawBody;
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (jobTitle !== undefined && typeof jobTitle !== "string") {
    return NextResponse.json({ error: "jobTitle must be a string" }, { status: 400 });
  }
  if (bio !== undefined && typeof bio !== "string") {
    return NextResponse.json({ error: "bio must be a string" }, { status: 400 });
  }
  if (socialUrls !== undefined) {
    if (!isRecord(socialUrls)) {
      return NextResponse.json({ error: "socialUrls must be an object" }, { status: 400 });
    }
    if (
      (socialUrls.twitter !== undefined && typeof socialUrls.twitter !== "string") ||
      (socialUrls.linkedin !== undefined && typeof socialUrls.linkedin !== "string") ||
      (socialUrls.website !== undefined && typeof socialUrls.website !== "string")
    ) {
      return NextResponse.json(
        { error: "socialUrls values must be strings" },
        { status: 400 }
      );
    }
  }
  if (
    expertiseAreas !== undefined &&
    (!Array.isArray(expertiseAreas) ||
      expertiseAreas.some((area) => typeof area !== "string"))
  ) {
    return NextResponse.json(
      { error: "expertiseAreas must be an array of strings" },
      { status: 400 }
    );
  }
  if (wpAuthorId !== undefined && (typeof wpAuthorId !== "number" || !Number.isFinite(wpAuthorId))) {
    return NextResponse.json(
      { error: "wpAuthorId must be a number" },
      { status: 400 }
    );
  }
  if (isDefault !== undefined && typeof isDefault !== "boolean") {
    return NextResponse.json(
      { error: "isDefault must be a boolean" },
      { status: 400 }
    );
  }

  const normalizedSocialUrls =
    socialUrls && isRecord(socialUrls)
      ? {
          ...(typeof socialUrls.twitter === "string" && {
            twitter: socialUrls.twitter,
          }),
          ...(typeof socialUrls.linkedin === "string" && {
            linkedin: socialUrls.linkedin,
          }),
          ...(typeof socialUrls.website === "string" && {
            website: socialUrls.website,
          }),
        }
      : undefined;
  const normalizedExpertiseAreas = Array.isArray(expertiseAreas)
    ? expertiseAreas.filter((area): area is string => typeof area === "string")
    : [];
  const normalizedJobTitle =
    typeof jobTitle === "string" ? jobTitle : undefined;
  const normalizedBio = typeof bio === "string" ? bio : undefined;
  const normalizedWpAuthorId =
    typeof wpAuthorId === "number" ? wpAuthorId : undefined;
  const normalizedIsDefault =
    typeof isDefault === "boolean" ? isDefault : false;

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const personaId = await convex.mutation(api.authorPersonas.create, {
      workspaceId: workspace._id,
      name: name.trim(),
      jobTitle: normalizedJobTitle,
      bio: normalizedBio,
      socialUrls: normalizedSocialUrls,
      expertiseAreas: normalizedExpertiseAreas,
      wpAuthorId: normalizedWpAuthorId,
      isDefault: normalizedIsDefault,
    });

    return NextResponse.json({ id: personaId }, { status: 201 });
  } catch (err) {
    console.error("[author-personas/POST]", err);
    return NextResponse.json(
      { error: "Failed to create author persona" },
      { status: 500 }
    );
  }
}
