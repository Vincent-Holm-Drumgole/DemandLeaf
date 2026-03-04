import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireWorkspaceAccess } from "./helpers";
import { ERR_AUTHOR_PERSONA_NOT_FOUND } from "./errors";
import { socialUrlsValidator } from "./validators";

const MAX_PERSONAS = 20;

export const listByWorkspace = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("authorPersonas")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .take(MAX_PERSONAS);
  },
});

export const getDefault = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return ctx.db
      .query("authorPersonas")
      .withIndex("by_workspace_default", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("isDefault", true)
      )
      .first();
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    jobTitle: v.optional(v.string()),
    bio: v.optional(v.string()),
    socialUrls: v.optional(socialUrlsValidator),
    expertiseAreas: v.array(v.string()),
    avatarUrl: v.optional(v.string()),
    wpAuthorId: v.optional(v.number()),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    if (args.isDefault) {
      const existing = await ctx.db
        .query("authorPersonas")
        .withIndex("by_workspace_default", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("isDefault", true)
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          isDefault: false,
          updatedAt: Date.now(),
        });
      }
    }

    const now = Date.now();
    return ctx.db.insert("authorPersonas", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    personaId: v.id("authorPersonas"),
    name: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    bio: v.optional(v.string()),
    socialUrls: v.optional(socialUrlsValidator),
    expertiseAreas: v.optional(v.array(v.string())),
    avatarUrl: v.optional(v.string()),
    wpAuthorId: v.optional(v.number()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { personaId, ...fields } = args;
    const persona = await ctx.db.get(personaId);
    if (!persona) throw new ConvexError(ERR_AUTHOR_PERSONA_NOT_FOUND);
    await requireWorkspaceAccess(ctx, persona.workspaceId);

    if (fields.isDefault) {
      const existing = await ctx.db
        .query("authorPersonas")
        .withIndex("by_workspace_default", (q) =>
          q.eq("workspaceId", persona.workspaceId).eq("isDefault", true)
        )
        .first();
      if (existing && existing._id !== personaId) {
        await ctx.db.patch(existing._id, {
          isDefault: false,
          updatedAt: Date.now(),
        });
      }
    }

    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(updates).length === 0) return;
    await ctx.db.patch(personaId, { ...updates, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { personaId: v.id("authorPersonas") },
  handler: async (ctx, args) => {
    const persona = await ctx.db.get(args.personaId);
    if (!persona) throw new ConvexError(ERR_AUTHOR_PERSONA_NOT_FOUND);
    await requireWorkspaceAccess(ctx, persona.workspaceId);
    await ctx.db.delete(args.personaId);
  },
});
