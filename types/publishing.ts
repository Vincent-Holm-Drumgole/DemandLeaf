export type WpAuthMethod = "application_password";
export type WpConnectionStatus = "connected" | "error" | "pending";
export type WpPlugin = "rankmath" | "yoast" | "none";
export type WpPostStatus = "draft" | "publish" | "future" | "private";
export type InternalLinkStatus = "suggested" | "accepted" | "rejected";
export type SchemaType = "Article" | "FAQPage" | "HowTo";

export interface WpConnection {
  _id: string;
  workspaceId: string;
  siteUrl: string;
  authMethod: WpAuthMethod;
  pluginDetected?: WpPlugin;
  status: WpConnectionStatus;
  lastTestedAt?: number;
}

export interface AuthorPersona {
  _id: string;
  workspaceId: string;
  name: string;
  jobTitle?: string;
  bio?: string;
  socialUrls?: { twitter?: string; linkedin?: string; website?: string };
  expertiseAreas: string[];
  avatarUrl?: string;
  wpAuthorId?: number;
  isDefault: boolean;
}

export interface InternalLinkSuggestion {
  targetBlogId: string;
  targetTitle: string;
  targetSlug: string;
  anchorText: string;
  similarity: number;
}

export interface PublishOptions {
  wpConnectionId: string;
  status: WpPostStatus;
  scheduledAt?: number;
  authorPersonaId?: string;
}

export interface SchemaMarkup {
  type: SchemaType;
  json: string;
}

export interface AeoCheckResult {
  name: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  suggestion?: string;
}

export interface AeoScore {
  score: number;
  checks: AeoCheckResult[];
  passedChecks: number;
  totalChecks: number;
}

export interface SnippetOpportunity {
  type: "definition" | "steps" | "list" | "table" | "faq";
  headingText: string;
  headingIndex: number;
  snippetType: string;
}

export interface ImagePlacement {
  afterWordCount: number;
  suggestedAlt: string | null;
  heading?: string;
}
