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
  strategyStatusValidator,
  searchIntentValidator,
  buyerStageValidator,
  keywordStatusValidator,
  briefStatusValidator,
  briefDataValidator,
  briefDataModificationsValidator,
  calendarStatusValidator,
  seoDataCacheDataValidator,
  // Phase 5
  wpAuthMethodValidator,
  wpConnectionStatusValidator,
  wpPluginValidator,
  internalLinkStatusValidator,
  schemaTypeValidator,
  wpStatusValidator,
  socialUrlsValidator,
  // Phase 6
  decayAlertTypeValidator,
  decayAlertSeverityValidator,
  decayAlertStatusValidator,
  diagnosisCauseValidator,
  refreshStatusValidator,
  googleConnectionStatusValidator,
  refreshBriefDataValidator,
  // Phase 7
  agentTypeValidator,
  agentActionStatusValidator,
  notificationTypeValidator,
  auditActorTypeValidator,
  // Phase 8
  publishingAgentStatusValidator,
  // Billing
  planStatusValidator,
  workspaceRoleValidator,
  scorecardDimensionAveragesValidator,
  scorecardDimensionValidator,
  scorecardReasonTagValidator,
  scorecardSuppressedTagValidator,
} from "./validators";

export default defineSchema({
  workspaces: defineTable({
    clerkUserId: v.string(),
    name: v.string(),
    url: v.optional(v.string()),
    industry: v.optional(v.string()),
    audienceDescription: v.optional(v.string()),
    masterContext: v.optional(v.string()),
    // Billing
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.optional(planStatusValidator),
    trialEndsAt: v.optional(v.number()),
    planExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_user", ["clerkUserId"])
    .index("by_clerk_user_created", ["clerkUserId", "createdAt"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    clerkUserId: v.string(),
    role: workspaceRoleValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_user", ["workspaceId", "clerkUserId"])
    .index("by_clerk_user", ["clerkUserId"]),

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
    // Phase 5: AEO/GEO & Publishing fields
    aeoScore: v.optional(v.number()),
    schemaType: v.optional(schemaTypeValidator),
    schemaJson: v.optional(v.string()),
    wpPostId: v.optional(v.number()),
    wpPostUrl: v.optional(v.string()),
    wpStatus: v.optional(wpStatusValidator),
    wpScheduledAt: v.optional(v.number()),
    wpConnectionId: v.optional(v.id("wpConnections")),
    authorPersonaId: v.optional(v.id("authorPersonas")),
    publishedAt: v.optional(v.number()),
    internalLinksGenerated: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created", ["workspaceId", "createdAt"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  scoredOutputs: defineTable({
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    brandVoice: v.number(),
    structure: v.number(),
    depthAccuracy: v.number(),
    readability: v.number(),
    onTopicFocus: v.number(),
    compositeScore: v.number(),
    reasonTags: v.array(scorecardReasonTagValidator),
    coachingNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created", ["workspaceId", "createdAt"])
    .index("by_blog", ["blogId"])
    .index("by_workspace_composite", ["workspaceId", "compositeScore"]),

  workspaceScoreStats: defineTable({
    workspaceId: v.id("workspaces"),
    totalScored: v.number(),
    avgComposite: v.number(),
    dimensionAverages: scorecardDimensionAveragesValidator,
    aiConfidence: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  coachingNotesLibrary: defineTable({
    workspaceId: v.id("workspaces"),
    note: v.string(),
    echoCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_echo", ["workspaceId", "echoCount"]),

  tagFrequency: defineTable({
    workspaceId: v.id("workspaces"),
    dimension: scorecardDimensionValidator,
    tag: v.string(),
    count: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_dimension", ["workspaceId", "dimension"]),

  generationContextLog: defineTable({
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    fewShotBlogIds: v.array(v.id("blogs")),
    suppressedTags: v.array(scorecardSuppressedTagValidator),
    coachingNotes: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_blog", ["blogId"])
    .index("by_workspace", ["workspaceId"]),

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

  knowledgeBaseChunks: defineTable({
    workspaceId: v.id("workspaces"),
    entryId: v.id("knowledgeBase"),
    chunkIndex: v.number(),
    content: v.string(),
    embedding: v.array(v.float64()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_entry", ["entryId"])
    .index("by_workspace", ["workspaceId"])
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

  // ── Phase 3: Strategy & Keyword Intelligence tables ──────────────────────────

  strategies: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    businessOutcomes: v.string(),
    targetAudience: v.optional(v.string()),
    seedKeywords: v.array(v.string()),
    status: strategyStatusValidator,
    driftCheckedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  keywords: defineTable({
    workspaceId: v.id("workspaces"),
    strategyId: v.id("strategies"),
    keyword: v.string(),
    searchVolume: v.optional(v.number()),
    keywordDifficulty: v.optional(v.number()), // 0–100
    cpc: v.optional(v.number()),
    searchIntent: v.optional(searchIntentValidator),
    buyerStage: v.optional(buyerStageValidator),
    opportunityScore: v.optional(v.number()),
    assignedBlogId: v.optional(v.id("blogs")),
    clusterId: v.optional(v.id("topicClusters")),
    status: keywordStatusValidator,
    dataFetchedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_strategy", ["strategyId"])
    .index("by_strategy_keyword", ["strategyId", "keyword"])
    .index("by_cluster", ["clusterId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  topicClusters: defineTable({
    workspaceId: v.id("workspaces"),
    strategyId: v.id("strategies"),
    name: v.string(),
    pillarKeyword: v.string(),
    pillarBlogId: v.optional(v.id("blogs")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_strategy", ["strategyId"]),

  contentBriefs: defineTable({
    workspaceId: v.id("workspaces"),
    strategyId: v.id("strategies"),
    keywordId: v.id("keywords"),
    briefData: briefDataValidator,
    status: briefStatusValidator,
    userModifications: v.optional(briefDataModificationsValidator),
    blogId: v.optional(v.id("blogs")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_keyword", ["keywordId"])
    .index("by_strategy", ["strategyId"]),

  contentCalendar: defineTable({
    workspaceId: v.id("workspaces"),
    strategyId: v.id("strategies"),
    briefId: v.optional(v.id("contentBriefs")),
    keywordId: v.id("keywords"),
    scheduledDate: v.number(), // epoch ms
    archetype: v.string(),
    priority: v.number(), // 1 = highest
    status: calendarStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_date", ["workspaceId", "scheduledDate"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_strategy", ["strategyId"])
    .index("by_workspace_strategy_date", ["workspaceId", "strategyId", "scheduledDate"])
    .index("by_strategy_keyword", ["strategyId", "keywordId"]),

  seoDataCache: defineTable({
    cacheKey: v.string(), // "keyword:{kw}", "serp:{kw}", "related:{kw}", "domain:{domain}"
    data: seoDataCacheDataValidator,
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_cache_key", ["cacheKey"]), // Not unique in Convex; duplicates are de-duped in convex/seoDataCache.ts.

  // ── Phase 5: AEO/GEO & Publishing tables ──────────────────────────────────────

  wpConnections: defineTable({
    workspaceId: v.id("workspaces"),
    siteUrl: v.string(),
    authMethod: wpAuthMethodValidator,
    encryptedCredentials: v.string(),
    credentialIv: v.string(),
    credentialTag: v.string(),
    pluginDetected: v.optional(wpPluginValidator),
    status: wpConnectionStatusValidator,
    lastTestedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  authorPersonas: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    jobTitle: v.optional(v.string()),
    bio: v.optional(v.string()),
    socialUrls: v.optional(socialUrlsValidator),
    expertiseAreas: v.array(v.string()),
    avatarUrl: v.optional(v.string()),
    wpAuthorId: v.optional(v.number()),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_default", ["workspaceId", "isDefault"]),

  internalLinks: defineTable({
    workspaceId: v.id("workspaces"),
    sourceBlogId: v.id("blogs"),
    targetBlogId: v.id("blogs"),
    anchorText: v.string(),
    similarity: v.number(),
    status: internalLinkStatusValidator,
    createdAt: v.number(),
  })
    .index("by_source_blog", ["sourceBlogId"])
    .index("by_workspace", ["workspaceId"]),

  // ── Phase 6: Post-Publish Intelligence tables ─────────────────────────────────

  rankSnapshots: defineTable({
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    keyword: v.string(),
    position: v.optional(v.number()),
    url: v.optional(v.string()),
    searchVolume: v.optional(v.number()),
    checkedAt: v.number(),
  })
    .index("by_blog", ["blogId"])
    .index("by_blog_checked", ["blogId", "checkedAt"])
    .index("by_workspace_checked", ["workspaceId", "checkedAt"]),

  performanceMetrics: defineTable({
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    sessions: v.optional(v.number()),
    pageviews: v.optional(v.number()),
    avgEngagementTimeSec: v.optional(v.number()),
    bounceRate: v.optional(v.number()),
    clicks: v.optional(v.number()),
    impressions: v.optional(v.number()),
    ctr: v.optional(v.number()),
    avgPosition: v.optional(v.number()),
    periodStart: v.number(),
    periodEnd: v.number(),
    measuredAt: v.number(),
  })
    .index("by_blog", ["blogId"])
    .index("by_blog_period", ["blogId", "periodStart"])
    .index("by_workspace_period", ["workspaceId", "periodStart"]),

  decayAlerts: defineTable({
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    alertType: decayAlertTypeValidator,
    severity: decayAlertSeverityValidator,
    triggeredAt: v.number(),
    status: decayAlertStatusValidator,
    baselineValue: v.number(),
    currentValue: v.number(),
    deltaPercent: v.number(),
    diagnosisCause: v.optional(diagnosisCauseValidator),
    diagnosisNotes: v.optional(v.string()),
    diagnosedAt: v.optional(v.number()),
    refreshHistoryId: v.optional(v.id("refreshHistory")),
    resolvedAt: v.optional(v.number()),
    escalatedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_blog", ["blogId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_triggered", ["workspaceId", "triggeredAt"]),

  refreshHistory: defineTable({
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    alertId: v.optional(v.id("decayAlerts")),
    briefData: refreshBriefDataValidator,
    refreshedContent: v.optional(v.string()),
    status: refreshStatusValidator,
    failureReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_blog", ["blogId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  googleConnections: defineTable({
    workspaceId: v.id("workspaces"),
    ga4PropertyId: v.optional(v.string()),
    gscSiteUrl: v.optional(v.string()),
    encryptedTokens: v.string(),
    tokenIv: v.string(),
    tokenTag: v.string(),
    scopes: v.array(v.string()),
    status: googleConnectionStatusValidator,
    lastSyncedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  // ── Phase 7: Agentic Operations tables ────────────────────────────────────────

  agentActions: defineTable({
    workspaceId: v.id("workspaces"),
    agentType: agentTypeValidator,
    status: agentActionStatusValidator,
    payload: v.any(),
    reasoning: v.string(),
    suggestedAt: v.number(),
    decidedAt: v.optional(v.number()),
    executedAt: v.optional(v.number()),
    failureReason: v.optional(v.string()),
    userNote: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_agent", ["workspaceId", "agentType"])
    .index("by_status_suggested", ["status", "suggestedAt"]),

  notifications: defineTable({
    workspaceId: v.id("workspaces"),
    type: notificationTypeValidator,
    agentType: agentTypeValidator,
    agentActionId: v.optional(v.id("agentActions")),
    title: v.string(),
    body: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_read", ["workspaceId", "read"]),

  agentAuditLog: defineTable({
    workspaceId: v.id("workspaces"),
    agentActionId: v.id("agentActions"),
    agentType: agentTypeValidator,
    event: v.string(),
    actorType: auditActorTypeValidator,
    detail: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_agent_action", ["agentActionId"])
    .index("by_workspace_agent", ["workspaceId", "agentType"]),

  // ── Phase 8: Agentic Operations v2 tables ─────────────────────────────────────

  competitorTracking: defineTable({
    workspaceId: v.id("workspaces"),
    strategyId: v.id("strategies"),
    domain: v.string(),
    trackedKeywords: v.array(v.string()),
    lastCheckedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_strategy", ["strategyId"]),

  publishingAgentConfig: defineTable({
    workspaceId: v.id("workspaces"),
    status: publishingAgentStatusValidator,
    pauseReason: v.optional(v.string()),
    pausedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),
});
