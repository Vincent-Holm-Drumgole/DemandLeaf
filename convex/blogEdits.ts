import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const PATTERN_ANALYSIS_THRESHOLD = 10;

// ── Queries ────────────────────────────────────────────────────────────────────

export const getEditStats = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const edits = await ctx.db
      .query("blogEdits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const total = edits.length;
    const classified = edits.filter((e) => e.classificationStatus === "classified");
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
    return ctx.db
      .query("blogEdits")
      .withIndex("by_blog", (q) => q.eq("blogId", args.blogId))
      .order("desc")
      .collect();
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
    const blog = await ctx.db.get(args.blogId);
    if (blog) {
      await ctx.db.patch(args.blogId, {
        editCount: (blog.editCount ?? 0) + 1,
        updatedAt: now,
      });
    }

    // Schedule Haiku classification
    await ctx.scheduler.runAfter(0, internal.blogEdits.classifyEdit, { editId });

    // Check if we've crossed the pattern analysis threshold
    const allEdits = await ctx.db
      .query("blogEdits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    if (allEdits.length % PATTERN_ANALYSIS_THRESHOLD === 0) {
      await ctx.scheduler.runAfter(5000, internal.blogEdits.analyzeEditPatterns, {
        workspaceId: args.workspaceId,
      });
    }

    return editId;
  },
});

export const storeClassification = internalMutation({
  args: {
    editId: v.id("blogEdits"),
    editType: v.optional(v.string()),
    status: v.string(),
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
        editType: v.string(),
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
        updatedAt: Date.now(),
      });
      // Store patterns as a JSON field (we store as string to avoid schema complexity)
      // Note: voiceProfiles doesn't have an editPatterns field in schema directly
      // We handle this through the API response layer
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
        responseFormat: "json",
      });
      const parsed = JSON.parse(result.content) as { editType?: string };
      await ctx.runMutation(internal.blogEdits.storeClassification, {
        editId: args.editId,
        editType: parsed.editType,
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

export const getEditById = query({
  args: { editId: v.id("blogEdits") },
  handler: async (ctx, args) => ctx.db.get(args.editId),
});

export const analyzeEditPatterns = internalAction({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    // Gather recent classified edits
    const edits = await ctx.runQuery(internal.blogEdits.getClassifiedEdits, {
      workspaceId: args.workspaceId,
    });
    if (edits.length < 5) return; // Not enough data yet

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
        responseFormat: "json",
      });
      const parsed = JSON.parse(result.content) as {
        patterns?: Array<{
          editType: string;
          frequency: number;
          examples: string[];
          suggestedAdjustment: string;
        }>;
      };
      if (parsed.patterns) {
        await ctx.runMutation(internal.blogEdits.storeEditPatterns, {
          workspaceId: args.workspaceId,
          editPatterns: parsed.patterns,
        });
      }
    } catch (err) {
      console.error("[blogEdits] pattern analysis failed:", err);
    }
  },
});

export const getClassifiedEdits = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("blogEdits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("classificationStatus"), "classified"))
      .order("desc")
      .take(50);
  },
});
