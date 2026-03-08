import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { requireRequestWorkspace } from "@/lib/workspace-server";
import { api } from "@/convex/_generated/api";
import type { KBEntryType } from "@/types";
import { KB_ENTRY_TYPES } from "@/types/knowledge-base";
import { checkRateLimit } from "@/lib/rate-limit";
import { hasConvexErrorCode } from "@/lib/convex-error";
import { ERR_UNAUTHORIZED } from "@/convex/errors";
import {
  MAX_KB_CONTENT_CHARS,
  MAX_KB_IMPORT_ENTRIES,
  MAX_KB_TAGS,
} from "@/lib/knowledge-base/constants";

const VALID_ENTRY_TYPES = new Set<KBEntryType>(KB_ENTRY_TYPES);

interface ImportEntryPayload {
  entryType?: string;
  title?: string;
  content?: string;
  tags?: string[];
  capabilityStatus?: string;
  discoveryNotes?: string;
  lastVerifiedAt?: number;
  claims?: Array<{
    statement?: string;
    sourceName?: string;
    sourceUrl?: string;
    confidence?: string;
    lastCheckedAt?: number;
    notes?: string;
  }>;
}

const VALID_CAPABILITY_STATUSES = new Set(["current", "planned"] as const);
const VALID_CLAIM_CONFIDENCES = new Set(["verified", "observed", "directional"] as const);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`kb-import:${userId}`, { limit: 10, windowSec: 60 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  let body: { entries?: ImportEntryPayload[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0) {
    return NextResponse.json({ error: "entries are required" }, { status: 400 });
  }
  if (entries.length > MAX_KB_IMPORT_ENTRIES) {
    return NextResponse.json(
      { error: `You can import up to ${MAX_KB_IMPORT_ENTRIES} entries at once` },
      { status: 400 },
    );
  }

  let normalizedEntries: Array<{
    entryType: KBEntryType;
    title: string;
    content: string;
    tags: string[];
    capabilityStatus: "current" | "planned";
    discoveryNotes?: string;
    lastVerifiedAt?: number;
    claims?: Array<{
      statement: string;
      sourceName: string;
      sourceUrl?: string;
      confidence: "verified" | "observed" | "directional";
      lastCheckedAt: number;
      notes?: string;
    }>;
  }>;
  try {
    normalizedEntries = entries.map((entry, index) => {
      if (!entry.entryType || !VALID_ENTRY_TYPES.has(entry.entryType as KBEntryType)) {
        throw new Error(`Entry ${index + 1} has an invalid entry type`);
      }
      if (!entry.title || typeof entry.title !== "string" || entry.title.trim().length === 0) {
        throw new Error(`Entry ${index + 1} is missing a title`);
      }
      if (!entry.content || typeof entry.content !== "string" || entry.content.trim().length === 0) {
        throw new Error(`Entry ${index + 1} is missing content`);
      }
      if (entry.content.trim().length > MAX_KB_CONTENT_CHARS) {
        throw new Error(`Entry ${index + 1} exceeds ${MAX_KB_CONTENT_CHARS} characters`);
      }
      if (
        entry.capabilityStatus !== undefined &&
        (typeof entry.capabilityStatus !== "string" ||
          !VALID_CAPABILITY_STATUSES.has(entry.capabilityStatus as "current" | "planned"))
      ) {
        throw new Error(`Entry ${index + 1} has an invalid capability status`);
      }

      return {
        entryType: entry.entryType as KBEntryType,
        title: entry.title.trim(),
        content: entry.content.trim(),
        tags: Array.isArray(entry.tags)
          ? entry.tags
              .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
              .map((tag) => tag.trim())
              .slice(0, MAX_KB_TAGS)
          : [],
        capabilityStatus:
          entry.capabilityStatus === "planned" ? "planned" : "current",
        discoveryNotes:
          typeof entry.discoveryNotes === "string" ? entry.discoveryNotes.trim() || undefined : undefined,
        lastVerifiedAt:
          typeof entry.lastVerifiedAt === "number" && Number.isFinite(entry.lastVerifiedAt)
            ? entry.lastVerifiedAt
            : undefined,
        claims: Array.isArray(entry.claims)
          ? entry.claims.map((claim, claimIndex) => {
              if (!claim.statement || typeof claim.statement !== "string") {
                throw new Error(`Entry ${index + 1} claim ${claimIndex + 1} is missing a statement`);
              }
              if (!claim.sourceName || typeof claim.sourceName !== "string") {
                throw new Error(`Entry ${index + 1} claim ${claimIndex + 1} is missing a sourceName`);
              }
              if (
                !claim.confidence ||
                typeof claim.confidence !== "string" ||
                !VALID_CLAIM_CONFIDENCES.has(claim.confidence as "verified" | "observed" | "directional")
              ) {
                throw new Error(`Entry ${index + 1} claim ${claimIndex + 1} has an invalid confidence`);
              }
              return {
                statement: claim.statement.trim(),
                sourceName: claim.sourceName.trim(),
                sourceUrl:
                  typeof claim.sourceUrl === "string" ? claim.sourceUrl.trim() || undefined : undefined,
                confidence: claim.confidence as "verified" | "observed" | "directional",
                lastCheckedAt:
                  typeof claim.lastCheckedAt === "number" && Number.isFinite(claim.lastCheckedAt)
                    ? claim.lastCheckedAt
                    : Date.now(),
                notes: typeof claim.notes === "string" ? claim.notes.trim() || undefined : undefined,
              };
            })
          : undefined,
      };
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid import payload" },
      { status: 400 },
    );
  }

  const convex = await getAuthedConvexClient();
  const workspace = await requireRequestWorkspace(convex, request);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  try {
    const ids = await convex.mutation(api.knowledgeBase.createMany, {
      workspaceId: workspace._id,
      entries: normalizedEntries,
    });
    return NextResponse.json({ count: ids.length }, { status: 201 });
  } catch (err) {
    if (hasConvexErrorCode(err, ERR_UNAUTHORIZED)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[knowledge-base/import/POST] mutation error:", err);
    return NextResponse.json({ error: "Failed to import entries" }, { status: 500 });
  }
}
