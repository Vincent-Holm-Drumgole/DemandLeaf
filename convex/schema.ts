import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  voiceAttributesValidator,
  vocabularyPreferencesValidator,
  voiceProfileValidator,
  crawlDataValidator,
  blogDataValidator,
} from "./validators";

export default defineSchema({
  workspaces: defineTable({
    clerkUserId: v.string(),
    name: v.string(),
    url: v.optional(v.string()),
    industry: v.optional(v.string()),
    audienceDescription: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_clerk_user_created", ["clerkUserId", "createdAt"]),

  voiceProfiles: defineTable({
    workspaceId: v.id("workspaces"),
    voiceAttributes: voiceAttributesValidator,
    voiceDescription: v.string(),
    vocabularyPreferences: v.optional(vocabularyPreferencesValidator),
    writingExamples: v.array(v.string()),
    sourceQuality: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  crawledPages: defineTable({
    workspaceId: v.id("workspaces"),
    url: v.string(),
    pageType: v.optional(v.string()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    wordCount: v.optional(v.number()),
    crawledAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_crawled", ["workspaceId", "crawledAt"]),

  blogs: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    slug: v.optional(v.string()),
    content: v.string(),
    contentHtml: v.optional(v.string()),
    metaTitle: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    focusKeyword: v.optional(v.string()),
    archetype: v.string(),
    wordCount: v.optional(v.number()),
    status: v.string(),
    // Scores
    seoScore: v.optional(v.number()),
    qualityScore: v.optional(v.number()),
    detectionRisk: v.optional(v.string()),
    detectionRiskScore: v.optional(v.number()),
    burstinessScore: v.optional(v.number()),
    readabilityScore: v.optional(v.number()),
    // Generation metadata
    modelUsed: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    generationCostCents: v.optional(v.number()),
    generationTimeMs: v.optional(v.number()),
    promptVersion: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created", ["workspaceId", "createdAt"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  blogFeedback: defineTable({
    blogId: v.id("blogs"),
    paragraphIndex: v.number(),
    feedback: v.string(),
    comment: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_blog", ["blogId"])
    .index("by_blog_created", ["blogId", "createdAt"]),

  promptVersions: defineTable({
    promptName: v.string(),
    version: v.string(),
    systemPrompt: v.string(),
    userPromptTemplate: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_name_active", ["promptName", "isActive"])
    .index("by_name_version", ["promptName", "version"]),

  anonymousSessions: defineTable({
    // UUID v4 — treated as unique. Uniqueness is enforced in the create
    // mutation rather than via a schema constraint (Convex has no UNIQUE index).
    sessionToken: v.string(),
    crawlData: v.optional(crawlDataValidator),
    voiceProfile: v.optional(voiceProfileValidator),
    blogData: v.optional(blogDataValidator),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["sessionToken"])
    .index("by_expires", ["expiresAt"]),
});
