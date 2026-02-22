import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { migrateAnonymousSessionToWorkspace } from "@/lib/session-store";
import type { SignupRequest } from "@/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: SignupRequest;
  try {
    body = (await request.json()) as SignupRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const name = typeof body.name === "string" ? body.name.trim() : null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const workspaceName = name ? `${name}'s Workspace` : "My Workspace";

  const { user, workspace } = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        authProvider: "email",
      },
    });

    const createdWorkspace = await tx.workspace.create({
      data: {
        userId: createdUser.id,
        name: workspaceName,
      },
    });

    return { user: createdUser, workspace: createdWorkspace };
  });

  let migrationResult: { migrated: boolean; reason?: string } | null = null;
  if (typeof body.sessionId === "string" && body.sessionId.trim().length > 0) {
    migrationResult = await migrateAnonymousSessionToWorkspace({
      sessionToken: body.sessionId.trim(),
      workspaceId: workspace.id,
    });
  }

  return NextResponse.json(
    {
      userId: user.id,
      workspaceId: workspace.id,
      migratedSession: migrationResult?.migrated ?? false,
      migrationReason: migrationResult?.reason ?? null,
    },
    { status: 201 }
  );
}
