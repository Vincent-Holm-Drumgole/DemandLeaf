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
}

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
