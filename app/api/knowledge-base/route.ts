import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { KBEntryType } from "@/types";
import { KB_ENTRY_TYPES } from "@/types/knowledge-base";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { FunctionReturnType } from "convex/server";
import { ERR_UNAUTHORIZED } from "@/convex/errors";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { MAX_KB_CONTENT_CHARS } from "@/lib/knowledge-base/constants";

const VALID_ENTRY_TYPES = new Set<KBEntryType>(KB_ENTRY_TYPES);
const VALID_CAPABILITY_STATUSES = new Set(["current", "planned"] as const);
const VALID_CLAIM_CONFIDENCES = new Set(["verified", "observed", "directional"] as const);

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
      const lastCheckedAt =
        typeof claim.lastCheckedAt === "number" && Number.isFinite(claim.lastCheckedAt)
          ? claim.lastCheckedAt
          : Date.now();
      return {
        statement: claim.statement.trim(),
        sourceName: claim.sourceName.trim(),
        sourceUrl: typeof claim.sourceUrl === "string" ? claim.sourceUrl.trim() || undefined : undefined,
        confidence: claim.confidence as "verified" | "observed" | "directional",
        lastCheckedAt,
        notes: typeof claim.notes === "string" ? claim.notes.trim() || undefined : undefined,
      };
    });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`kb-list:${userId}`, { limit: 120, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  const { searchParams } = new URL(request.url);
  const entryTypeRaw = searchParams.get("type");
  const entryType =
    entryTypeRaw && VALID_ENTRY_TYPES.has(entryTypeRaw as KBEntryType)
      ? (entryTypeRaw as KBEntryType)
      : undefined;

  if (entryTypeRaw && !entryType) {
    return NextResponse.json({ error: "Invalid entry type filter" }, { status: 400 });
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let entries: FunctionReturnType<typeof api.knowledgeBase.listByWorkspace>;
  try {
    entries = await convex.query(api.knowledgeBase.listByWorkspace, {
      workspaceId: workspace._id,
      entryType,
    });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[knowledge-base/GET] query error:", err);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e._id,
      workspaceId: e.workspaceId,
      entryType: e.entryType,
      title: e.title,
      content: e.content,
      tags: e.tags,
      embeddingStatus: e.embeddingStatus,
      embeddingError: e.embeddingError,
      embeddingVersion: e.embeddingVersion ?? 0,
      lastVerifiedAt: e.lastVerifiedAt ?? e.updatedAt,
      capabilityStatus: e.capabilityStatus ?? "current",
      discoveryNotes: e.discoveryNotes,
      claims: e.claims.map((claim: (typeof e.claims)[number]) => ({
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
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`kb-create:${ip}`, { limit: 30, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
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
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { entryType, title, content, tags = [] } = body;

  if (!entryType || !VALID_ENTRY_TYPES.has(entryType as KBEntryType)) {
    return NextResponse.json({ error: "Invalid or missing entryType" }, { status: 400 });
  }
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.trim().length > MAX_KB_CONTENT_CHARS) {
    return NextResponse.json(
      { error: `content must be ${MAX_KB_CONTENT_CHARS} characters or less` },
      { status: 400 },
    );
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
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  let entryId: Id<"knowledgeBase">;
  try {
    entryId = await convex.mutation(api.knowledgeBase.create, {
      workspaceId: workspace._id,
      entryType: entryType as KBEntryType,
      title: title.trim(),
      content: content.trim(),
      tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [],
      capabilityStatus:
        body.capabilityStatus === "planned" ? "planned" : "current",
      discoveryNotes:
        typeof body.discoveryNotes === "string" ? body.discoveryNotes.trim() || undefined : undefined,
      lastVerifiedAt:
        typeof body.lastVerifiedAt === "number" && Number.isFinite(body.lastVerifiedAt)
          ? body.lastVerifiedAt
          : undefined,
      claims,
    });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[knowledge-base/POST] mutation error:", err);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }

  return NextResponse.json({ id: entryId, embeddingStatus: "pending" }, { status: 201 });
}
