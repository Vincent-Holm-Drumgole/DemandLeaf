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
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await convex.query(api.workspaces.getByClerkUser, {});
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const personaId = await convex.mutation(api.authorPersonas.create, {
    workspaceId: workspace._id,
    name: body.name,
    jobTitle: body.jobTitle,
    bio: body.bio,
    socialUrls: body.socialUrls,
    expertiseAreas: body.expertiseAreas ?? [],
    wpAuthorId: body.wpAuthorId,
    isDefault: body.isDefault ?? false,
  });

  return NextResponse.json({ id: personaId }, { status: 201 });
}
