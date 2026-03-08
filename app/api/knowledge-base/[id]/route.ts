import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseConvexId } from "@/lib/convex-id";
import { ERR_ENTRY_NOT_FOUND, ERR_UNAUTHORIZED } from "@/convex/errors";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { MAX_KB_CONTENT_CHARS } from "@/lib/knowledge-base/constants";
import { KB_ENTRY_TYPES } from "@/types/knowledge-base";
import type { KBEntryType } from "@/types";
const VALID_CAPABILITY_STATUSES = new Set(["current", "planned"] as const);
const VALID_CLAIM_CONFIDENCES = new Set(["verified", "observed", "directional"] as const);
const VALID_ENTRY_TYPES = new Set<KBEntryType>(KB_ENTRY_TYPES);

function normalizeClaims(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((claim): claim is Record<string, unknown> => Boolean(claim) && typeof claim === "object")
    .map((claim, index) => {
      if (typeof claim.statement !== "string" || claim.statement.trim().length === 0) {
        throw new Error(`Claim ${index + 1} is missing a statement`);
      }
      if (typeof claim.sourceName !== "string" || claim.sourceName.trim().length === 0) {
        throw new Error(`Claim ${index + 1} is missing a sourceName`);
      }
      if (
        typeof claim.confidence !== "string" ||
        !VALID_CLAIM_CONFIDENCES.has(claim.confidence as "verified" | "observed" | "directional")
      ) {
        throw new Error(`Claim ${index + 1} has an invalid confidence`);
      }
      return {
        statement: claim.statement.trim(),
        sourceName: claim.sourceName.trim(),
        sourceUrl: typeof claim.sourceUrl === "string" ? claim.sourceUrl.trim() || undefined : undefined,
        confidence: claim.confidence as "verified" | "observed" | "directional",
        lastCheckedAt:
          typeof claim.lastCheckedAt === "number" && Number.isFinite(claim.lastCheckedAt)
            ? claim.lastCheckedAt
            : Date.now(),
        notes: typeof claim.notes === "string" ? claim.notes.trim() || undefined : undefined,
      };
    });
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`kb-get:${userId}`, { limit: 120, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await context.params;
  const entryId = parseConvexId(id, "knowledgeBase");
  if (!entryId) {
    return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let entry;
  try {
    entry = await convex.query(api.knowledgeBase.getById, {
      entryId,
      workspaceId: workspace._id,
    });
  } catch (err) {
    console.error("[knowledge-base/[id]/GET] error:", err);
    return NextResponse.json({ error: "Failed to fetch entry" }, { status: 500 });
  }

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json({
    ...entry,
    id: entry._id,
    claims: entry.claims.map((claim: (typeof entry.claims)[number]) => ({
      id: claim._id,
      entryId: claim.entryId,
      statement: claim.statement,
      sourceName: claim.sourceName,
      sourceUrl: claim.sourceUrl ?? undefined,
      confidence: claim.confidence,
      lastCheckedAt: claim.lastCheckedAt,
      notes: claim.notes ?? undefined,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
    })),
    lastVerifiedAt: entry.lastVerifiedAt ?? entry.updatedAt,
    capabilityStatus: entry.capabilityStatus ?? "current",
  });
}

export async function PUT(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`kb-update:${userId}`, { limit: 30, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await context.params;
  const entryId = parseConvexId(id, "knowledgeBase");
  if (!entryId) {
    return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
  }

  let body: {
    entryType?: string;
    title?: string;
    content?: string;
    tags?: string[];
    capabilityStatus?: string;
    discoveryNotes?: string;
    lastVerifiedAt?: number;
    claims?: unknown;
    autoDraftClaims?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.content && body.content.trim().length > MAX_KB_CONTENT_CHARS) {
    return NextResponse.json(
      { error: `content must be ${MAX_KB_CONTENT_CHARS} characters or less` },
      { status: 400 },
    );
  }
  if (body.tags && !Array.isArray(body.tags)) {
    return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
  }
  if (
    body.entryType !== undefined &&
    (typeof body.entryType !== "string" || !VALID_ENTRY_TYPES.has(body.entryType as KBEntryType))
  ) {
    return NextResponse.json({ error: "entryType is invalid" }, { status: 400 });
  }
  if (
    body.capabilityStatus !== undefined &&
    (typeof body.capabilityStatus !== "string" || !VALID_CAPABILITY_STATUSES.has(body.capabilityStatus as "current" | "planned"))
  ) {
    return NextResponse.json({ error: "capabilityStatus must be current or planned" }, { status: 400 });
  }

  let claims;
  try {
    claims = normalizeClaims(body.claims);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid claims" },
      { status: 400 },
    );
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    await convex.mutation(api.knowledgeBase.update, {
      entryId,
      workspaceId: workspace._id,
      entryType: typeof body.entryType === "string" ? body.entryType as KBEntryType : undefined,
      title: body.title?.trim(),
      content: body.content?.trim(),
      tags: body.tags?.filter((tag): tag is string => typeof tag === "string"),
      capabilityStatus: typeof body.capabilityStatus === "string" ? body.capabilityStatus as "current" | "planned" : undefined,
      discoveryNotes:
        typeof body.discoveryNotes === "string" ? body.discoveryNotes.trim() || undefined : undefined,
      lastVerifiedAt:
        typeof body.lastVerifiedAt === "number" && Number.isFinite(body.lastVerifiedAt)
          ? body.lastVerifiedAt
          : undefined,
      claims,
      autoDraftClaims: body.autoDraftClaims === true,
    });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_ENTRY_NOT_FOUND)) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[knowledge-base/[id]/PUT] error:", err);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, context: RouteParams): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`kb-delete:${userId}`, { limit: 30, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { id } = await context.params;
  const entryId = parseConvexId(id, "knowledgeBase");
  if (!entryId) {
    return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  try {
    await convex.mutation(api.knowledgeBase.remove, {
      entryId,
      workspaceId: workspace._id,
    });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_ENTRY_NOT_FOUND)) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[knowledge-base/[id]/DELETE] error:", err);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
