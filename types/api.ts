import type { Archetype, BlogScores, PipelineStep, AICallBreakdown } from "./blog";
import type { SourceQuality } from "./voice";

// POST /api/crawl
export interface CrawlRequest {
  url: string;
}

export interface CrawlResponse {
  sessionId: string;
  companyName: string;
  industry: string;
  audience: string;
  audienceExpertise: string;
  voiceProfile: {
    description: string;
    sourceQuality: SourceQuality;
    toneAttributes: string[];
  };
  pagesFound: number;
}

// POST /api/generate
export interface GenerateRequest {
  sessionId: string;
  keyword: string;
  archetype: Archetype;
}

export interface GenerateSSEEvent {
  type: "progress" | "complete" | "error";
  step?: PipelineStep;
  result?: GenerateResult;
  message?: string;
}

export interface GenerateResult {
  blogId: string;
  content: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  scores: BlogScores;
  wordCount: number;
  generationTimeMs: number;
  totalCostCents: number;
  aiCalls: AICallBreakdown[];
}

// POST /api/blog/:id/feedback
export interface FeedbackRequest {
  paragraphIndex: number;
  feedback: "positive" | "negative";
  comment?: string;
}

// POST /api/export/:id
export interface ExportRequest {
  format: "html" | "markdown" | "clipboard";
}

// POST /api/auth/signup
export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
  sessionId?: string;
}

// GET /api/dashboard
export interface DashboardBlog {
  id: string;
  title: string;
  archetype: Archetype;
  status: string;
  seoScore: number | null;
  qualityScore: number | null;
  detectionRisk: string | null;
  wordCount: number | null;
  createdAt: string;
}

export interface DashboardResponse {
  blogs: DashboardBlog[];
  workspaceName: string;
}
