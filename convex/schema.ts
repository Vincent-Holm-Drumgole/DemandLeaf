import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  voiceAttributesValidator,
  vocabularyPreferencesValidator,
  voiceProfileValidator,
  crawlDataValidator,
  blogDataValidator,
  kbEntryTypeValidator,
  editTypeValidator,
  embeddingStatusValidator,
  termTypeValidator,
  classificationStatusValidator,
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
    // Phase 2: Brand intelligence fields
    thoughtLeadershipPositions: v.optional(v.array(v.string())),
    brandPhilosophy: v.optional(v.string()),
    wizardCompleted: v.optional(v.boolean()),
    wizardCompletedAt: v.optional(v.number()),
    calibrationCount: v.optional(v.number()),
    editCount: v.optional(v.number()),
    editPatterns: v.optional(
      v.array(
        v.object({
          editType: editTypeValidator,
          frequency: v.number(),
          examples: v.array(v.string()),
          suggestedAdjustment: v.string(),
        })
      )
    ),
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
    // Phase 2: Confidence fields
    voiceMatchScore: v.optional(v.number()),
    userApproval: v.optional(v.boolean()),
    editCount: v.optional(v.number()),
    editRatio: v.optional(v.number()),
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

  // ── Phase 2: Brand Intelligence tables ──────────────────────────────────────

  knowledgeBase: defineTable({
    workspaceId: v.id("workspaces"),
    entryType: kbEntryTypeValidator,
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    embedding: v.optional(v.array(v.float64())),
    embeddingStatus: embeddingStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "entryType"])
    .index("by_workspace_status", ["workspaceId", "embeddingStatus"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["workspaceId"],
    }),

  neverSayList: defineTable({
    workspaceId: v.id("workspaces"),
    term: v.string(),
    termType: termTypeValidator,
    addedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  calibrationHistory: defineTable({
    workspaceId: v.id("workspaces"),
    voiceProfileId: v.id("voiceProfiles"),
    sampleParagraph: v.string(),
    rating: v.number(), // 1-10
    feedback: v.optional(v.string()),
    addedToExamples: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created", ["workspaceId", "createdAt"]),

  blogEdits: defineTable({
    blogId: v.id("blogs"),
    workspaceId: v.id("workspaces"),
    paragraphIndex: v.number(),
    originalText: v.string(),
    editedText: v.string(),
    editType: v.optional(editTypeValidator), // classified by Haiku
    classificationStatus: classificationStatusValidator,
    createdAt: v.number(),
  })
    .index("by_blog", ["blogId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created", ["workspaceId", "createdAt"])
    .index("by_workspace_unclassified", ["workspaceId", "classificationStatus"]),
});
