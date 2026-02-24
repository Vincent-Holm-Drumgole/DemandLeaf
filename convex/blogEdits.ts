import {
  mutation,
  query,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { requireWorkspaceAccess } from "./helpers";
import { ERR_UNAUTHENTICATED, ERR_UNAUTHORIZED, ERR_BLOG_NOT_FOUND } from "./errors";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { classificationStatusValidator, editTypeValidator } from "./validators";

const PATTERN_ANALYSIS_THRESHOLD = 10;

// ── Queries ────────────────────────────────────────────────────────────────────

export const getEditStats = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const profile = await ctx.db
      .query("voiceProfiles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();

    const classified = await ctx.db
      .query("blogEdits")
      .withIndex("by_workspace_unclassified", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("classificationStatus", "classified"),
      )
      .collect();

    const total = profile?.editCount ?? 0;
    const byType: Record<string, number> = {};
    for (const edit of classified) {
      if (edit.editType) {
        byType[edit.editType] = (byType[edit.editType] ?? 0) + 1;
      }
    }
    return { total, classified: classified.length, byType };
  },
});

export const listByBlog = query({
  args: { blogId: v.id("blogs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error(ERR_UNAUTHENTICATED);
    }

    const blog = await ctx.db.get(args.blogId);
    if (!blog) {
      return [];
    }
    const workspace = await ctx.db.get(blog.workspaceId);
    if (!workspace || workspace.clerkUserId !== identity.subject) {
      throw new Error(ERR_UNAUTHORIZED);
    }

    return ctx.db
      .query("blogEdits")
      .withIndex("by_blog", (q) => q.eq("blogId", args.blogId))
      .order("desc")
      .collect();
  },
});

export const hasMinimumClassifiedEdits = query({
  args: {
    workspaceId: v.id("workspaces"),
    minimum: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const minimum = Math.max(1, Math.min(Math.floor(args.minimum ?? 5), 100));
    const classified = await ctx.db
      .query("blogEdits")
      .withIndex("by_workspace_unclassified", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("classificationStatus", "classified"),
      )
      .take(minimum);

    return {
      ready: classified.length >= minimum,
      count: classified.length,
      minimum,
    };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const recordEdit = mutation({
  args: {
    blogId: v.id("blogs"),
    workspaceId: v.id("workspaces"),
    paragraphIndex: v.number(),
    originalText: v.string(),
    editedText: v.string(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== args.workspaceId) {
      throw new Error(ERR_BLOG_NOT_FOUND);
    }

    const now = Date.now();
    const editId = await ctx.db.insert("blogEdits", {
      blogId: args.blogId,
      workspaceId: args.workspaceId,
      paragraphIndex: args.paragraphIndex,
      originalText: args.originalText,
      editedText: args.editedText,
      classificationStatus: "pending",
      createdAt: now,
    });

    // Increment blog edit count
    await ctx.db.patch(args.blogId, {
      editCount: (blog.editCount ?? 0) + 1,
      updatedAt: now,
    });

    // Schedule Haiku classification
    await ctx.scheduler.runAfter(0, internal.blogEdits.classifyEdit, { editId });

    // Atomically increment workspace-level edit counter on voiceProfile
    // and use it for the threshold check — avoids a full table scan and
    // eliminates the race condition where concurrent inserts could both
    // read the same count and either both trigger or skip pattern analysis.
    const profile = await ctx.db
      .query("voiceProfiles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (profile) {
      const newEditCount = (profile.editCount ?? 0) + 1;
      await ctx.db.patch(profile._id, { editCount: newEditCount, updatedAt: now });
      if (newEditCount % PATTERN_ANALYSIS_THRESHOLD === 0) {
        await ctx.scheduler.runAfter(15000, internal.blogEdits.analyzeEditPatterns, {
          workspaceId: args.workspaceId,
        });
      }
    } else {
      console.warn(
        `[blogEdits] missing voice profile for workspace ${String(args.workspaceId)}; skipped pattern counter`,
      );
    }

    return editId;
  },
});

export const requestPatternAnalysis = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    await ctx.scheduler.runAfter(0, internal.blogEdits.analyzeEditPatterns, {
      workspaceId: args.workspaceId,
    });
  },
});

export const storeClassification = internalMutation({
  args: {
    editId: v.id("blogEdits"),
    editType: v.optional(editTypeValidator),
    status: classificationStatusValidator,
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.editId, {
      editType: args.editType,
      classificationStatus: args.status,
    });
  },
});

export const storeEditPatterns = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    editPatterns: v.array(
      v.object({
        editType: editTypeValidator,
        frequency: v.number(),
        examples: v.array(v.string()),
        suggestedAdjustment: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Find the workspace's voice profile and update editPatterns
    const profile = await ctx.db
      .query("voiceProfiles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .unique();
    if (profile) {
      await ctx.db.patch(profile._id, {
        editPatterns: args.editPatterns,
        updatedAt: Date.now(),
      });
    }
  },
});

// ── Internal Actions (AI calls) ───────────────────────────────────────────────

export const classifyEdit = internalAction({
  args: { editId: v.id("blogEdits") },
  handler: async (ctx, args) => {
    // Get the edit record via internalQuery workaround
    const edit = await ctx.runQuery(internal.blogEdits.getEditById, { editId: args.editId });
    if (!edit) return;

    try {
      const { callAI } = await import("../lib/ai/client");
      const { buildEditClassificationPrompt } = await import(
        "../lib/ai/prompts/editClassification"
      );
      const { systemPrompt, userMessage } = buildEditClassificationPrompt(
        edit.originalText,
        edit.editedText
      );
      const result = await callAI({
        model: "haiku",
        systemPrompt,
        userMessage,
        maxTokens: 256,
        temperature: 0.1,
      });
      const parsed = JSON.parse(result.content) as { editType?: string };
      await ctx.runMutation(internal.blogEdits.storeClassification, {
        editId: args.editId,
        editType: toEditType(parsed.editType),
        status: "classified",
      });
    } catch (err) {
      console.error("[blogEdits] classification failed:", err);
      await ctx.runMutation(internal.blogEdits.storeClassification, {
        editId: args.editId,
        editType: undefined,
        status: "failed",
      });
    }
  },
});

export const getEditById = internalQuery({
  args: { editId: v.id("blogEdits") },
  handler: async (ctx, args) => ctx.db.get(args.editId),
});

export const analyzeEditPatterns = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const progress = await ctx.runQuery(internal.blogEdits.getClassificationProgress, {
      workspaceId: args.workspaceId,
    });
    if (progress.classifiedCount < 5) {
      // Classification is async. If pending edits still exist, retry shortly.
      if (progress.hasPending) {
        await ctx.scheduler.runAfter(15000, internal.blogEdits.analyzeEditPatterns, {
          workspaceId: args.workspaceId,
        });
      }
      return;
    }

    // Gather recent classified edits
    const edits = await ctx.runQuery(internal.blogEdits.getClassifiedEdits, {
      workspaceId: args.workspaceId,
    });

    try {
      const { callAI } = await import("../lib/ai/client");
      const { buildEditPatternAnalysisPrompt } = await import(
        "../lib/ai/prompts/editPatternAnalysis"
      );
      const { systemPrompt, userMessage } = buildEditPatternAnalysisPrompt(
        edits.map((e) => ({
          editType: e.editType ?? "unknown",
          originalText: e.originalText,
          editedText: e.editedText,
        }))
      );
      const result = await callAI({
        model: "haiku",
        systemPrompt,
        userMessage,
        maxTokens: 1024,
        temperature: 0.1,
      });
      const parsed = JSON.parse(result.content) as {
        patterns?: Array<{
          editType: string;
          frequency: number;
          examples: string[];
          suggestedAdjustment: string;
        }>;
      };
      const patterns = (parsed.patterns ?? [])
        .map((pattern) => ({
          ...pattern,
          editType: toEditType(pattern.editType),
        }))
        .filter(
          (
            pattern,
          ): pattern is {
            editType: "tone" | "factual" | "restructure" | "style" | "addition" | "deletion";
            frequency: number;
            examples: string[];
            suggestedAdjustment: string;
          } =>
            Boolean(pattern.editType) &&
            Number.isFinite(pattern.frequency) &&
            pattern.frequency > 0 &&
            Array.isArray(pattern.examples) &&
            typeof pattern.suggestedAdjustment === "string",
        );

      if (patterns.length > 0) {
        await ctx.runMutation(internal.blogEdits.storeEditPatterns, {
          workspaceId: args.workspaceId,
          editPatterns: patterns,
        });
      }
    } catch (err) {
      console.error("[blogEdits] pattern analysis failed:", err);
    }
  },
});

export const getClassifiedEdits = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("blogEdits")
      .withIndex("by_workspace_unclassified", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("classificationStatus", "classified"),
      )
      .order("desc")
      .take(50);
  },
});

export const getClassificationProgress = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const classified = await ctx.db
      .query("blogEdits")
      .withIndex("by_workspace_unclassified", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("classificationStatus", "classified"),
      )
      .take(5);

    const pending = await ctx.db
      .query("blogEdits")
      .withIndex("by_workspace_unclassified", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("classificationStatus", "pending"),
      )
      .take(1);

    return {
      classifiedCount: classified.length,
      hasPending: pending.length > 0,
    };
  },
});


function toEditType(
  value: unknown,
): "tone" | "factual" | "restructure" | "style" | "addition" | "deletion" | undefined {
  if (
    value === "tone" ||
    value === "factual" ||
    value === "restructure" ||
    value === "style" ||
    value === "addition" ||
    value === "deletion"
  ) {
    return value;
  }
  return undefined;
}
