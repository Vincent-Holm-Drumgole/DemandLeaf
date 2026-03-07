import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireCronAccess, requireWorkspaceAccess, requireWorkspaceAdminAccess } from "./helpers";
import {
  ERR_BLOG_ALREADY_SCORED,
  ERR_BLOG_NOT_FOUND,
  ERR_COACHING_NOTE_TOO_LONG,
  ERR_INVALID_DIMENSION_SCORE,
  ERR_WORKSPACE_MISMATCH,
} from "./errors";
import {
  scorecardReasonTagValidator,
  scorecardSuppressedTagValidator,
} from "./validators";
import {
  FEW_SHOT_COMPOSITE_THRESHOLD,
  FEW_SHOT_LIMIT,
  MAX_COACHING_NOTE_LENGTH,
  MIN_SCORED_OUTPUTS_FOR_FEW_SHOTS,
  normalizeReasonTag,
  type ScorecardDimension,
  SCORECARD_DIMENSIONS,
  SCORECARD_DIMENSION_LABELS,
  SCORECARD_DIMENSION_WEIGHTS,
  SUPPRESSED_TAG_THRESHOLD,
  isPresetReasonTag,
  isScorecardDimension,
} from "../lib/scorecard/tags";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LIST_LIMIT = 200;
const MAX_UNSCORED_BLOG_SCAN = 200;
const MAX_SCORED_LOOKUP = 500;
const MAX_RECENT_SCORES = 20;
const MAX_RECOMPUTE_SCORES = 5_000;
const MAX_TAG_FREQUENCY_DOCS = 200;
const MAX_COACHING_NOTE_DOCS = 500;
const MAX_FEW_SHOT_CANDIDATES = 20;
const MAX_REASON_TAGS_PER_SCORE = 25;

type DimensionScores = Record<ScorecardDimension, number>;
type DimensionAverages = Record<ScorecardDimension, number>;

type ReasonTag = Doc<"scoredOutputs">["reasonTags"][number];
type SuppressedTag = Doc<"generationContextLog">["suppressedTags"][number];

const ZERO_DIMENSION_SCORES: DimensionAverages = {
  brandVoice: 0,
  structure: 0,
  depthAccuracy: 0,
  readability: 0,
  onTopicFocus: 0,
};

export const submit = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    brandVoice: v.number(),
    structure: v.number(),
    depthAccuracy: v.number(),
    readability: v.number(),
    onTopicFocus: v.number(),
    reasonTags: v.array(scorecardReasonTagValidator),
    coachingNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAdminAccess(ctx, args.workspaceId);

    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_BLOG_NOT_FOUND);
    }

    const existing = await ctx.db
      .query("scoredOutputs")
      .withIndex("by_blog", (q) => q.eq("blogId", args.blogId))
      .take(1);
    if (existing.length > 0) {
      throw new ConvexError(ERR_BLOG_ALREADY_SCORED);
    }

    const scores = validateDimensionScores(args);
    const coachingNote = normalizeCoachingNote(args.coachingNote);
    const reasonTags = normalizeReasonTags(args.reasonTags);
    const compositeScore = calculateCompositeScore(scores);
    const now = Date.now();

    const scoredOutputId = await ctx.db.insert("scoredOutputs", {
      workspaceId: args.workspaceId,
      blogId: args.blogId,
      brandVoice: scores.brandVoice,
      structure: scores.structure,
      depthAccuracy: scores.depthAccuracy,
      readability: scores.readability,
      onTopicFocus: scores.onTopicFocus,
      compositeScore,
      reasonTags,
      coachingNote,
      createdAt: now,
      updatedAt: now,
    });

    const stats = await recomputeWorkspaceArtifacts(ctx, args.workspaceId, now);

    return {
      scoredOutputId,
      compositeScore,
      aiConfidence: stats.aiConfidence,
    };
  },
});

const deleteScoredOutput = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAdminAccess(ctx, args.workspaceId);

    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_BLOG_NOT_FOUND);
    }

    const scoredOutput = await getScoredOutputByBlog(ctx, args.blogId);
    if (!scoredOutput) {
      return { deleted: false };
    }

    await ctx.db.delete(scoredOutput._id);
    const stats = await recomputeWorkspaceArtifacts(ctx, args.workspaceId, Date.now());

    return {
      deleted: true,
      totalScored: stats.totalScored,
    };
  },
});

export { deleteScoredOutput as delete };

export const listUnscored = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const limit = clampInt(args.limit ?? 50, 1, MAX_LIST_LIMIT);
    const [blogs, scoredOutputs] = await Promise.all([
      ctx.db
        .query("blogs")
        .withIndex("by_workspace_created", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(MAX_UNSCORED_BLOG_SCAN),
      ctx.db
        .query("scoredOutputs")
        .withIndex("by_workspace_created", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(MAX_SCORED_LOOKUP),
    ]);

    const scoredBlogIds = new Set(scoredOutputs.map((output) => output.blogId));
    return blogs
      .filter((blog) => !scoredBlogIds.has(blog._id))
      .slice(0, limit)
      .map((blog) => ({
        blogId: blog._id,
        title: blog.title,
        archetype: blog.archetype,
        createdAt: blog.createdAt,
        wordCount: blog.wordCount ?? null,
        seoScore: blog.seoScore ?? null,
        voiceMatchScore: blog.voiceMatchScore ?? null,
      }));
  },
});

export const listScored = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const limit = clampInt(args.limit ?? MAX_LIST_LIMIT, 1, MAX_LIST_LIMIT);
    const scoredOutputs = await ctx.db
      .query("scoredOutputs")
      .withIndex("by_workspace_created", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);

    return hydrateScoredOutputs(ctx, scoredOutputs);
  },
});

export const getByBlog = query({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const blog = await ctx.db.get(args.blogId);
    if (!blog || blog.workspaceId !== args.workspaceId) {
      throw new ConvexError(ERR_BLOG_NOT_FOUND);
    }

    const scoredOutput = await getScoredOutputByBlog(ctx, args.blogId);
    if (!scoredOutput) return null;

    return buildHydratedScoreRow(blog, scoredOutput);
  },
});

export const getDashboard = query({
  args: {
    workspaceId: v.id("workspaces"),
    windowDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);

    const windowDays = clampInt(args.windowDays ?? 30, 7, 365);
    const now = Date.now();
    const cutoff = now - windowDays * DAY_MS;
    const monthStart = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      1,
    );

    const [statsDoc, trendScores, tagFrequency, recentScores, monthScores] = await Promise.all([
      getWorkspaceStatsDoc(ctx, args.workspaceId),
      ctx.db
        .query("scoredOutputs")
        .withIndex("by_workspace_created", (q) =>
          q.eq("workspaceId", args.workspaceId).gte("createdAt", cutoff),
        )
        .order("desc")
        .take(MAX_RECOMPUTE_SCORES),
      ctx.db
        .query("tagFrequency")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .take(MAX_TAG_FREQUENCY_DOCS),
      ctx.db
        .query("scoredOutputs")
        .withIndex("by_workspace_created", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(MAX_RECENT_SCORES),
      ctx.db
        .query("scoredOutputs")
        .withIndex("by_workspace_created", (q) =>
          q.eq("workspaceId", args.workspaceId).gte("createdAt", monthStart),
        )
        .order("desc")
        .take(MAX_RECOMPUTE_SCORES),
    ]);

    const trendByDate = new Map<string, { totalComposite: number; count: number }>();
    for (const score of [...trendScores].reverse()) {
      const day = toDayKey(score.createdAt);
      const current = trendByDate.get(day) ?? { totalComposite: 0, count: 0 };
      current.totalComposite += score.compositeScore;
      current.count += 1;
      trendByDate.set(day, current);
    }

    const trend = Array.from(trendByDate.entries()).map(([date, value]) => ({
      date,
      avgComposite: roundToOneDecimal(value.totalComposite / value.count),
      count: value.count,
    }));

    const stats = statsDoc
      ? {
          totalScored: statsDoc.totalScored,
          avgComposite: statsDoc.avgComposite,
          dimensionAverages: statsDoc.dimensionAverages,
          aiConfidence: statsDoc.aiConfidence,
        }
      : buildEmptyStats();

    const topFailureTags = [...tagFrequency]
      .sort((a, b) => b.count - a.count || a.dimension.localeCompare(b.dimension) || a.tag.localeCompare(b.tag))
      .slice(0, 10)
      .map((tagDoc) => {
        const dimension = toScorecardDimension(tagDoc.dimension);
        if (!dimension) return null;
        return {
          dimension,
          dimensionLabel: SCORECARD_DIMENSION_LABELS[dimension],
          tag: tagDoc.tag,
          count: tagDoc.count,
        };
      })
      .filter((tagDoc): tagDoc is NonNullable<typeof tagDoc> => Boolean(tagDoc));

    return {
      stats: {
        ...stats,
        scoredThisMonth: monthScores.length,
      },
      trend,
      topFailureTags,
      recentScores: await hydrateScoredOutputs(ctx, recentScores),
    };
  },
});

export const getTrainingSignals = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    return queryTrainingSignals(ctx, args.workspaceId);
  },
});

export const getTrainingSignalsForCron = query({
  args: {
    workspaceId: v.id("workspaces"),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    return queryTrainingSignals(ctx, args.workspaceId);
  },
});

export const logGenerationContext = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    fewShotBlogIds: v.array(v.id("blogs")),
    suppressedTags: v.array(scorecardSuppressedTagValidator),
    coachingNotes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireWorkspaceAccess(ctx, args.workspaceId);
    await insertGenerationContextLog(ctx, args);
  },
});

export const logGenerationContextForCron = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    blogId: v.id("blogs"),
    fewShotBlogIds: v.array(v.id("blogs")),
    suppressedTags: v.array(scorecardSuppressedTagValidator),
    coachingNotes: v.array(v.string()),
    cronKey: v.string(),
  },
  handler: async (ctx, args) => {
    requireCronAccess(args.cronKey);
    const { cronKey, ...payload } = args;
    void cronKey;
    await insertGenerationContextLog(ctx, payload);
  },
});

async function insertGenerationContextLog(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    blogId: Id<"blogs">;
    fewShotBlogIds: Id<"blogs">[];
    suppressedTags: SuppressedTag[];
    coachingNotes: string[];
  },
) {
  const blog = await ctx.db.get(args.blogId);
  if (!blog) {
    throw new ConvexError(ERR_BLOG_NOT_FOUND);
  }
  if (blog.workspaceId !== args.workspaceId) {
    throw new ConvexError(ERR_WORKSPACE_MISMATCH);
  }

  await ctx.db.insert("generationContextLog", {
    workspaceId: args.workspaceId,
    blogId: args.blogId,
    fewShotBlogIds: args.fewShotBlogIds,
    suppressedTags: args.suppressedTags,
    coachingNotes: args.coachingNotes.map((note) => note.trim()).filter((note) => note.length > 0),
    createdAt: Date.now(),
  });
}

async function queryTrainingSignals(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const stats = await getWorkspaceStatsDoc(ctx, workspaceId);
  const totalScored = stats?.totalScored ?? 0;

  const [tagDocs, recentNotes, echoedNotes, fewShotCandidates] = await Promise.all([
    ctx.db
      .query("tagFrequency")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(MAX_TAG_FREQUENCY_DOCS),
    ctx.db
      .query("coachingNotesLibrary")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(MAX_COACHING_NOTE_DOCS),
    ctx.db
      .query("coachingNotesLibrary")
      .withIndex("by_workspace_echo", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(6),
    totalScored >= MIN_SCORED_OUTPUTS_FOR_FEW_SHOTS
      ? ctx.db
          .query("scoredOutputs")
          .withIndex("by_workspace_composite", (q) =>
            q.eq("workspaceId", workspaceId).gte("compositeScore", FEW_SHOT_COMPOSITE_THRESHOLD),
          )
          .order("desc")
          .take(MAX_FEW_SHOT_CANDIDATES)
      : Promise.resolve([]),
  ]);

  const suppressedTags = [...tagDocs]
    .filter((tagDoc) => tagDoc.count >= SUPPRESSED_TAG_THRESHOLD)
    .sort((a, b) => b.count - a.count || a.dimension.localeCompare(b.dimension) || a.tag.localeCompare(b.tag))
    .map((tagDoc) => ({
      dimension: tagDoc.dimension,
      tag: tagDoc.tag,
      count: tagDoc.count,
    }));

  const coachingNotes = mergeCoachingNotes(recentNotes, echoedNotes);
  const fewShotExamples = await buildFewShotExamples(ctx, fewShotCandidates);

  return {
    fewShotExamples,
    suppressedTags,
    coachingNotes,
  };
}

async function buildFewShotExamples(
  ctx: QueryCtx,
  candidates: Doc<"scoredOutputs">[],
) {
  const sorted = [...candidates].sort(
    (a, b) => b.compositeScore - a.compositeScore || b.createdAt - a.createdAt,
  );

  const examples = await Promise.all(
    sorted.slice(0, MAX_FEW_SHOT_CANDIDATES).map(async (candidate) => {
      const blog = await ctx.db.get(candidate.blogId);
      if (!blog) return null;
      return {
        blogId: blog._id,
        title: blog.title,
        compositeScore: candidate.compositeScore,
        excerpt: blog.content.slice(0, 500).trim(),
      };
    }),
  );

  return examples.filter((example): example is NonNullable<typeof example> => Boolean(example)).slice(0, FEW_SHOT_LIMIT);
}

async function hydrateScoredOutputs(
  ctx: QueryCtx,
  scoredOutputs: Doc<"scoredOutputs">[],
) {
  const rows = await Promise.all(
    scoredOutputs.map(async (scoredOutput) => {
      const blog = await ctx.db.get(scoredOutput.blogId);
      if (!blog) return null;
      return buildHydratedScoreRow(blog, scoredOutput);
    }),
  );

  return rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function buildHydratedScoreRow(blog: Doc<"blogs">, scoredOutput: Doc<"scoredOutputs">) {
  const dimensionScores = pickDimensionScores(scoredOutput);
  const lowestDimension = getLowestDimension(dimensionScores);

  return {
    scoredOutputId: scoredOutput._id,
    blogId: blog._id,
    title: blog.title,
    archetype: blog.archetype,
    blogCreatedAt: blog.createdAt,
    scoredAt: scoredOutput.createdAt,
    wordCount: blog.wordCount ?? null,
    seoScore: blog.seoScore ?? null,
    voiceMatchScore: blog.voiceMatchScore ?? null,
    compositeScore: scoredOutput.compositeScore,
    dimensionScores,
    reasonTags: scoredOutput.reasonTags,
    coachingNote: scoredOutput.coachingNote ?? null,
    lowestDimension: {
      dimension: lowestDimension.dimension,
      label: SCORECARD_DIMENSION_LABELS[lowestDimension.dimension],
      score: lowestDimension.score,
    },
  };
}

async function recomputeWorkspaceArtifacts(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  now: number,
) {
  const scoredOutputs = await ctx.db
    .query("scoredOutputs")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .take(MAX_RECOMPUTE_SCORES);

  const desiredTagFrequency = new Map<
    string,
    {
      dimension: ScorecardDimension;
      tag: string;
      count: number;
      createdAt: number;
      updatedAt: number;
    }
  >();

  const desiredNotes = new Map<
    string,
    {
      note: string;
      echoCount: number;
      createdAt: number;
      updatedAt: number;
    }
  >();

  for (const scoredOutput of scoredOutputs) {
    for (const tag of scoredOutput.reasonTags) {
      const dimension = toScorecardDimension(tag.dimension);
      if (!dimension || !isPresetReasonTag(dimension, tag.tag)) continue;

      const key = `${dimension}:${tag.tag.toLowerCase()}`;
      const existing = desiredTagFrequency.get(key);
      if (existing) {
        existing.count += 1;
        existing.updatedAt = Math.max(existing.updatedAt, scoredOutput.createdAt);
      } else {
        desiredTagFrequency.set(key, {
          dimension,
          tag: tag.tag,
          count: 1,
          createdAt: scoredOutput.createdAt,
          updatedAt: scoredOutput.createdAt,
        });
      }
    }

    if (scoredOutput.coachingNote) {
      const existing = desiredNotes.get(scoredOutput.coachingNote);
      if (existing) {
        existing.echoCount += 1;
        existing.updatedAt = Math.max(existing.updatedAt, scoredOutput.createdAt);
      } else {
        desiredNotes.set(scoredOutput.coachingNote, {
          note: scoredOutput.coachingNote,
          echoCount: 1,
          createdAt: scoredOutput.createdAt,
          updatedAt: scoredOutput.createdAt,
        });
      }
    }
  }

  await syncTagFrequency(ctx, workspaceId, desiredTagFrequency);
  await syncCoachingNotesLibrary(ctx, workspaceId, desiredNotes);

  const stats =
    scoredOutputs.length === 0
      ? {
          totalScored: 0,
          avgComposite: 0,
          dimensionAverages: { ...ZERO_DIMENSION_SCORES },
          aiConfidence: 0,
        }
      : buildWorkspaceStats(scoredOutputs, desiredNotes, now);

  await syncWorkspaceStats(ctx, workspaceId, stats, now);
  return stats;
}

function buildWorkspaceStats(
  scoredOutputs: Doc<"scoredOutputs">[],
  desiredNotes: Map<string, { echoCount: number }>,
  now: number,
) {
  const dimensionTotals: DimensionAverages = { ...ZERO_DIMENSION_SCORES };
  let compositeTotal = 0;

  for (const output of scoredOutputs) {
    const dimensionScores = pickDimensionScores(output);
    for (const dimension of SCORECARD_DIMENSIONS) {
      dimensionTotals[dimension] += dimensionScores[dimension];
    }
    compositeTotal += output.compositeScore;
  }

  const totalScored = scoredOutputs.length;
  const dimensionAverages = SCORECARD_DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension] = roundToOneDecimal(dimensionTotals[dimension] / totalScored);
    return acc;
  }, { ...ZERO_DIMENSION_SCORES });

  const composites = scoredOutputs.map((output) => output.compositeScore);
  const scoresInLast60Days = scoredOutputs.filter(
    (output) => output.createdAt >= now - 60 * DAY_MS,
  ).length;
  const hasAnyNotes = desiredNotes.size > 0;
  const hasEchoedNotes = Array.from(desiredNotes.values()).some((note) => note.echoCount > 1);

  const volume = Math.min(100, (1 - 1 / (1 + totalScored / 10)) * 100);
  const recency = (scoresInLast60Days / Math.max(totalScored, 1)) * 100;
  const consistency = Math.max(0, (1 - calculateStandardDeviation(composites) / 10) * 100);
  const coaching = hasEchoedNotes ? 100 : hasAnyNotes ? 50 : 0;
  const aiConfidence = roundToOneDecimal(
    volume * 0.3 + recency * 0.3 + consistency * 0.25 + coaching * 0.15,
  );

  return {
    totalScored,
    avgComposite: roundToOneDecimal(compositeTotal / totalScored),
    dimensionAverages,
    aiConfidence,
  };
}

async function syncWorkspaceStats(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  stats: {
    totalScored: number;
    avgComposite: number;
    dimensionAverages: DimensionAverages;
    aiConfidence: number;
  },
  now: number,
) {
  const existingDocs = await ctx.db
    .query("workspaceScoreStats")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .take(5);

  const [primary, ...duplicates] = [...existingDocs].sort((a, b) => a.createdAt - b.createdAt);
  for (const duplicate of duplicates) {
    await ctx.db.delete(duplicate._id);
  }

  const payload = {
    workspaceId,
    totalScored: stats.totalScored,
    avgComposite: stats.avgComposite,
    dimensionAverages: stats.dimensionAverages,
    aiConfidence: stats.aiConfidence,
    createdAt: primary?.createdAt ?? now,
    updatedAt: now,
  };

  if (primary) {
    await ctx.db.patch(primary._id, payload);
  } else {
    await ctx.db.insert("workspaceScoreStats", payload);
  }
}

async function syncTagFrequency(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  desiredFrequency: Map<
    string,
    {
      dimension: ScorecardDimension;
      tag: string;
      count: number;
      createdAt: number;
      updatedAt: number;
    }
  >,
) {
  const existingDocs = await ctx.db
    .query("tagFrequency")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .take(MAX_TAG_FREQUENCY_DOCS);

  const existingByKey = new Map(
    existingDocs.flatMap((doc) => {
      const dimension = toScorecardDimension(doc.dimension);
      return dimension ? [[tagFrequencyKey(dimension, doc.tag), doc] as const] : [];
    }),
  );

  for (const [key, desired] of desiredFrequency.entries()) {
    const existing = existingByKey.get(key);
    if (existing) {
      await ctx.db.patch(existing._id, {
        dimension: desired.dimension,
        tag: desired.tag,
        count: desired.count,
        updatedAt: desired.updatedAt,
      });
      existingByKey.delete(key);
    } else {
      await ctx.db.insert("tagFrequency", {
        workspaceId,
        dimension: desired.dimension,
        tag: desired.tag,
        count: desired.count,
        createdAt: desired.createdAt,
        updatedAt: desired.updatedAt,
      });
    }
  }

  for (const staleDoc of existingByKey.values()) {
    await ctx.db.delete(staleDoc._id);
  }
}

async function syncCoachingNotesLibrary(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  desiredNotes: Map<
    string,
    {
      note: string;
      echoCount: number;
      createdAt: number;
      updatedAt: number;
    }
  >,
) {
  const existingDocs = await ctx.db
    .query("coachingNotesLibrary")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .take(MAX_COACHING_NOTE_DOCS);

  const existingByNote = new Map<string, Doc<"coachingNotesLibrary">[]>();
  for (const doc of existingDocs) {
    const docs = existingByNote.get(doc.note) ?? [];
    docs.push(doc);
    existingByNote.set(doc.note, docs);
  }

  for (const [note, desired] of desiredNotes.entries()) {
    const existing = (existingByNote.get(note) ?? []).sort((a, b) => a.createdAt - b.createdAt);
    const [primary, ...duplicates] = existing;

    for (const duplicate of duplicates) {
      await ctx.db.delete(duplicate._id);
    }

    if (primary) {
      await ctx.db.patch(primary._id, {
        note: desired.note,
        echoCount: desired.echoCount,
        updatedAt: desired.updatedAt,
      });
    } else {
      await ctx.db.insert("coachingNotesLibrary", {
        workspaceId,
        note: desired.note,
        echoCount: desired.echoCount,
        createdAt: desired.createdAt,
        updatedAt: desired.updatedAt,
      });
    }

    existingByNote.delete(note);
  }

  for (const staleDocs of existingByNote.values()) {
    for (const staleDoc of staleDocs) {
      await ctx.db.delete(staleDoc._id);
    }
  }
}

async function getWorkspaceStatsDoc(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  const docs = await ctx.db
    .query("workspaceScoreStats")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .take(5);

  return [...docs].sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)[0] ?? null;
}

async function getScoredOutputByBlog(ctx: QueryCtx | MutationCtx, blogId: Id<"blogs">) {
  const docs = await ctx.db
    .query("scoredOutputs")
    .withIndex("by_blog", (q) => q.eq("blogId", blogId))
    .take(2);
  return docs[0] ?? null;
}

function validateDimensionScores(args: {
  brandVoice: number;
  structure: number;
  depthAccuracy: number;
  readability: number;
  onTopicFocus: number;
}): DimensionScores {
  const scores: DimensionScores = {
    brandVoice: args.brandVoice,
    structure: args.structure,
    depthAccuracy: args.depthAccuracy,
    readability: args.readability,
    onTopicFocus: args.onTopicFocus,
  };

  for (const score of Object.values(scores)) {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new ConvexError(ERR_INVALID_DIMENSION_SCORE);
    }
  }

  return scores;
}

function normalizeReasonTags(reasonTags: ReasonTag[]): ReasonTag[] {
  const normalized: ReasonTag[] = [];
  const seen = new Set<string>();

  for (const reasonTag of reasonTags.slice(0, MAX_REASON_TAGS_PER_SCORE)) {
    const dimension = toScorecardDimension(reasonTag.dimension);
    if (!dimension) continue;

    const tag = normalizeReasonTag(dimension, reasonTag.tag);
    if (!tag) continue;

    const key = `${dimension}:${tag.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      dimension,
      tag,
    });
  }

  return normalized;
}

function normalizeCoachingNote(note: string | undefined) {
  if (!note) return undefined;
  const normalized = note.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return undefined;
  if (normalized.length > MAX_COACHING_NOTE_LENGTH) {
    throw new ConvexError(ERR_COACHING_NOTE_TOO_LONG);
  }
  return normalized;
}

function calculateCompositeScore(scores: DimensionScores) {
  const weightedAverage = SCORECARD_DIMENSIONS.reduce(
    (sum, dimension) => sum + scores[dimension] * SCORECARD_DIMENSION_WEIGHTS[dimension],
    0,
  );
  return roundToOneDecimal(weightedAverage * 2);
}

function calculateStandardDeviation(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function mergeCoachingNotes(
  allNotes: Doc<"coachingNotesLibrary">[],
  echoedNotes: Doc<"coachingNotesLibrary">[],
) {
  const merged = new Map<string, string>();

  for (const note of [...allNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)) {
    merged.set(note.note, note.note);
  }

  for (const note of echoedNotes.slice(0, 3)) {
    if (merged.size >= 3) break;
    if (merged.has(note.note)) continue;
    merged.set(note.note, note.note);
  }

  return Array.from(merged.values()).slice(0, 3);
}

function pickDimensionScores(scoredOutput: Doc<"scoredOutputs">): DimensionScores {
  return {
    brandVoice: scoredOutput.brandVoice,
    structure: scoredOutput.structure,
    depthAccuracy: scoredOutput.depthAccuracy,
    readability: scoredOutput.readability,
    onTopicFocus: scoredOutput.onTopicFocus,
  };
}

function getLowestDimension(scores: DimensionScores) {
  let lowestDimension: ScorecardDimension = SCORECARD_DIMENSIONS[0];
  let lowestScore = scores[lowestDimension];

  for (const dimension of SCORECARD_DIMENSIONS.slice(1)) {
    if (scores[dimension] < lowestScore) {
      lowestDimension = dimension;
      lowestScore = scores[dimension];
    }
  }

  return {
    dimension: lowestDimension,
    score: lowestScore,
  };
}

function buildEmptyStats() {
  return {
    totalScored: 0,
    avgComposite: 0,
    dimensionAverages: { ...ZERO_DIMENSION_SCORES },
    aiConfidence: 0,
  };
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function toDayKey(timestamp: number) {
  return new Date(timestamp).toISOString().split("T")[0];
}

function tagFrequencyKey(dimension: ScorecardDimension, tag: string) {
  return `${dimension}:${tag.trim().toLowerCase()}`;
}

function toScorecardDimension(value: string): ScorecardDimension | null {
  return isScorecardDimension(value) ? value : null;
}
