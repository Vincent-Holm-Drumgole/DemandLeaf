import type { GapResult, GapType, Opportunity } from "@/types/content-map";

// ── Minimal input shapes ──────────────────────────────────────────────────────

export interface KWInput {
  _id: string;
  keyword: string;
  status: string;
  clusterId?: string;
  searchIntent?: string;
  buyerStage?: string;
  opportunityScore?: number;
  searchVolume?: number;
  keywordDifficulty?: number;
}

export interface BlogInput {
  _id: string;
  title: string;
  focusKeyword?: string | null;
  archetype: string;
  status: string;
  seoScore?: number | null;
  updatedAt: number;
  content?: string;
}

export interface ClusterInput {
  _id: string;
  name: string;
  pillarKeyword: string;
}

// ── 1. Cluster gaps ───────────────────────────────────────────────────────────

export function clusterGaps(
  clusters: ClusterInput[],
  keywords: KWInput[]
): GapResult {
  const COVERED = new Set(["written", "published", "ranking"]);
  const total = keywords.filter((k) => k.clusterId).length;
  const uncovered = keywords.filter(
    (k) => k.clusterId && !COVERED.has(k.status)
  );
  const count = uncovered.length;
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  // Top 5 examples — prefer high-opportunity ones
  const examples = uncovered
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
    .slice(0, 5)
    .map((k) => k.keyword);

  const coveredRatio = total > 0 ? (total - count) / total : 1;
  const severity: GapResult["severity"] =
    coveredRatio < 0.25 ? "high" : coveredRatio < 0.5 ? "medium" : "low";

  return {
    type: "cluster",
    title: "Cluster Coverage",
    description: "Keywords in your topic clusters that don't yet have a blog.",
    severity,
    count,
    total,
    percentage,
    items: examples,
  };
}

// ── 2. Funnel gaps ────────────────────────────────────────────────────────────

const BUYER_STAGES = ["awareness", "consideration", "decision"] as const;

export function funnelGaps(keywords: KWInput[]): GapResult {
  const counts: Record<string, number> = {
    awareness: 0,
    consideration: 0,
    decision: 0,
  };
  let mapped = 0;
  for (const k of keywords) {
    if (k.buyerStage && k.buyerStage in counts) {
      counts[k.buyerStage]++;
      mapped++;
    }
  }
  const missing = BUYER_STAGES.filter((s) => counts[s] === 0);
  const thin = BUYER_STAGES.filter(
    (s) => counts[s] > 0 && mapped > 0 && counts[s] / mapped < 0.1
  );
  const count = missing.length + thin.length;
  const total = BUYER_STAGES.length;
  const percentage = Math.round((count / total) * 100);

  const severity: GapResult["severity"] =
    missing.length > 0 ? "high" : thin.length > 0 ? "medium" : "low";

  return {
    type: "funnel",
    title: "Funnel Coverage",
    description:
      "Buyer journey stages with no or very thin keyword coverage.",
    severity,
    count,
    total,
    percentage,
    items: [
      ...missing.map((s) => `${s} (0 keywords)`),
      ...thin.map((s) => `${s} (<10% share)`),
    ],
  };
}

// ── 3. Intent gaps ────────────────────────────────────────────────────────────

const INTENTS = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
] as const;

export function intentGaps(keywords: KWInput[]): GapResult {
  const counts: Record<string, number> = {
    informational: 0,
    commercial: 0,
    transactional: 0,
    navigational: 0,
  };
  for (const k of keywords) {
    if (k.searchIntent && k.searchIntent in counts) {
      counts[k.searchIntent]++;
    }
  }
  const missing = INTENTS.filter((i) => counts[i] === 0);
  const count = missing.length;
  const total = INTENTS.length;
  const percentage = Math.round((count / total) * 100);

  const severity: GapResult["severity"] =
    count >= 2 ? "high" : count === 1 ? "medium" : "low";

  return {
    type: "intent",
    title: "Search Intent Coverage",
    description: "Search intent categories with no keyword targeting.",
    severity,
    count,
    total,
    percentage,
    items: missing.map((i) => `${i} (0 keywords)`),
  };
}

// ── 4. Archetype gaps ─────────────────────────────────────────────────────────

const ALL_ARCHETYPES = [
  "how_to",
  "listicle",
  "definitive_guide",
  "thought_leadership",
  "comparison",
  "data_study",
  "case_study",
  "news_commentary",
] as const;

export function archetypeGaps(blogs: BlogInput[]): GapResult {
  const used = new Set(blogs.map((b) => b.archetype));
  const missing = ALL_ARCHETYPES.filter((a) => !used.has(a));
  const count = missing.length;
  const total = ALL_ARCHETYPES.length;
  const percentage = Math.round((count / total) * 100);

  const severity: GapResult["severity"] =
    count >= 5 ? "high" : count >= 3 ? "medium" : "low";

  return {
    type: "archetype",
    title: "Content Format Diversity",
    description: "Blog archetypes you haven't used yet.",
    severity,
    count,
    total,
    percentage,
    items: missing.map((a) => a.replace(/_/g, " ")),
  };
}

// ── 5. Freshness gaps ─────────────────────────────────────────────────────────

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

export function freshnessGaps(blogs: BlogInput[]): GapResult {
  const cutoff = Date.now() - SIX_MONTHS_MS;
  const stale = blogs.filter(
    (b) => b.updatedAt < cutoff && (b.seoScore == null || b.seoScore < 70)
  );
  const count = stale.length;
  const total = blogs.length;
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const severity: GapResult["severity"] =
    percentage > 30 ? "high" : percentage > 15 ? "medium" : "low";

  return {
    type: "freshness",
    title: "Content Freshness",
    description: "Blogs older than 6 months with SEO score below 70.",
    severity,
    count,
    total,
    percentage,
    items: stale.slice(0, 5).map((b) => b.title),
  };
}

// ── 6. AEO gaps ───────────────────────────────────────────────────────────────

export function aeoGaps(blogs: BlogInput[]): GapResult {
  // Proxy: content that has no "?" character (no questions = no FAQ structure)
  const noQStructure = blogs.filter((b) => {
    const c = b.content ?? "";
    return !c.includes("?");
  });
  const count = noQStructure.length;
  const total = blogs.length;
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  const severity: GapResult["severity"] =
    percentage > 50 ? "high" : percentage > 25 ? "medium" : "low";

  return {
    type: "aeo",
    title: "AEO Readiness",
    description:
      "Blogs lacking question-based content (FAQ, Q&A) needed for AI citation.",
    severity,
    count,
    total,
    percentage,
    items: noQStructure.slice(0, 5).map((b) => b.title),
  };
}

// ── 7. Cannibalization gaps ───────────────────────────────────────────────────

export function cannibalizationGaps(
  // Reserved for future cross-blog phrase-overlap detection via keyword/phrase data
  _keywords: KWInput[],
  blogs: BlogInput[]
): GapResult {
  const pairSet = new Set<string>();

  const addPair = (label: string) => {
    pairSet.add(label);
  };

  // Check: two blogs sharing the same focusKeyword
  const keywordToBlogs = new Map<string, BlogInput[]>();
  for (const b of blogs) {
    const kw = b.focusKeyword?.toLowerCase().trim();
    if (!kw) continue;
    if (!keywordToBlogs.has(kw)) keywordToBlogs.set(kw, []);
    keywordToBlogs.get(kw)!.push(b);
  }
  for (const [kw, blist] of keywordToBlogs.entries()) {
    if (blist.length > 1) {
      addPair(`"${kw}" — ${blist.map((b) => b.title).join(" vs. ")}`);
    }
  }

  // Check: two blog titles sharing any exact 4-word phrase.
  // Matching a 4-gram guarantees at least 4 consecutive overlapping words.
  for (let i = 0; i < blogs.length; i++) {
    const words1 = tokenizeTitle(blogs[i].title);
    for (let j = i + 1; j < blogs.length; j++) {
      const words2 = tokenizeTitle(blogs[j].title);
      if (hasSharedConsecutiveRun(words1, words2, 4)) {
        addPair(`"${blogs[i].title}" / "${blogs[j].title}"`);
      }
    }
  }

  const pairs = Array.from(pairSet);
  const count = pairs.length;
  const total = blogs.length;
  const severity: GapResult["severity"] =
    count >= 3 ? "high" : count >= 1 ? "medium" : "low";

  return {
    type: "cannibalization",
    title: "Keyword Cannibalization",
    description: "Blogs competing for the same keywords or near-duplicate titles.",
    severity,
    count,
    total,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    items: pairs.slice(0, 5),
  };
}

function tokenizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ""))
    .filter((word) => word.length > 0);
}

function hasSharedConsecutiveRun(
  wordsA: string[],
  wordsB: string[],
  minRun: number
): boolean {
  if (wordsA.length < minRun || wordsB.length < minRun) return false;

  const [shorter, longer] =
    wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];

  const grams = new Set<string>();
  for (let i = 0; i <= shorter.length - minRun; i++) {
    grams.add(shorter.slice(i, i + minRun).join(" "));
  }

  for (let i = 0; i <= longer.length - minRun; i++) {
    if (grams.has(longer.slice(i, i + minRun).join(" "))) {
      return true;
    }
  }

  return false;
}

// ── Opportunity engine ────────────────────────────────────────────────────────

const SEVERITY_SCORE: Record<GapResult["severity"], number> = {
  high: 80,
  medium: 50,
  low: 20,
};

const EFFORT_MAP: Record<GapType, Opportunity["effort"]> = {
  cluster: "medium",
  funnel: "medium",
  intent: "medium",
  archetype: "low",
  freshness: "medium",
  aeo: "low",
  cannibalization: "high",
};

const ACTION_MAP: Record<GapType, { label: string; href: string }> = {
  cluster: { label: "View Keywords", href: "/keywords" },
  funnel: { label: "View Strategy", href: "/strategy" },
  intent: { label: "View Strategy", href: "/strategy" },
  archetype: { label: "Generate Blog", href: "/dashboard" },
  freshness: { label: "View Blogs", href: "/dashboard" },
  aeo: { label: "View Blogs", href: "/dashboard" },
  cannibalization: { label: "Review Blogs", href: "/dashboard" },
};

export function computeOpportunities(
  gaps: GapResult[],
  keywords: KWInput[]
): Opportunity[] {
  const topKwScore =
    keywords.length > 0
      ? Math.max(...keywords.map((k) => k.opportunityScore ?? 0))
      : 0;

  const opps: Opportunity[] = [];

  for (const gap of gaps) {
    if (gap.severity === "low" && gap.count === 0) continue;

    const base = SEVERITY_SCORE[gap.severity];
    // Bonus for keyword opportunity potential
    const kwBonus = gap.type === "cluster" ? Math.min(20, topKwScore / 100) : 0;
    const impactScore = Math.min(100, Math.round(base + kwBonus));

    const action = ACTION_MAP[gap.type];
    opps.push({
      id: gap.type,
      gapType: gap.type,
      title: gap.title,
      description: gap.description,
      impactScore,
      effort: EFFORT_MAP[gap.type],
      actionLabel: action.label,
      actionHref: action.href,
    });
  }

  return opps.sort((a, b) => b.impactScore - a.impactScore);
}
