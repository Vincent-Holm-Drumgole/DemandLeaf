export interface ClusterBubble {
  id: string;
  name: string;
  pillarKeyword: string;
  blogCount: number;
  keywordCount: number;
  coveredCount: number;
  avgSeoScore: number | null;
  gapCount: number;
  dominantArchetype: string | null;
  dominantBuyerStage: string | null;
}

export type GapType =
  | "cluster"
  | "funnel"
  | "intent"
  | "archetype"
  | "freshness"
  | "aeo"
  | "cannibalization";

export interface GapResult {
  type: GapType;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  count: number;
  total: number;
  percentage: number;
  items: string[];
}

export interface Opportunity {
  id: string;
  gapType: GapType;
  title: string;
  description: string;
  impactScore: number;
  effort: "low" | "medium" | "high";
  actionLabel: string;
  actionHref: string;
}

export interface ContentMapData {
  clusters: ClusterBubble[];
  gaps: GapResult[];
  opportunities: Opportunity[];
  summary: {
    totalBlogs: number;
    totalKeywords: number;
    totalClusters: number;
    coveredKeywords: number;
    overallHealth: number;
  };
  analysis?: {
    blogsAnalyzed: number;
    blogLimit: number;
    blogsMayBeTruncated: boolean;
    keywordsAnalyzed: number;
    keywordLimit: number;
    keywordsMayBeTruncated: boolean;
    clustersAnalyzed: number;
    clusterLimit: number;
    clustersMayBeTruncated: boolean;
  };
}
