export const KB_ENTRY_TYPES = [
  "company_info",
  "product",
  "audience",
  "competitor",
  "industry",
  "customer_story",
  "expert_insight",
  "proprietary_data",
  "hot_take",
  "lesson_learned",
  "methodology",
  "thought_leadership_position",
] as const;

export type KBEntryType = (typeof KB_ENTRY_TYPES)[number];

export type KBEmbeddingStatus = "pending" | "ready" | "failed";
export type KBCapabilityStatus = "current" | "planned";
export type KBClaimConfidence = "verified" | "observed" | "directional";

export interface KBClaim {
  id: string;
  entryId: string;
  statement: string;
  sourceName: string;
  sourceUrl?: string;
  confidence: KBClaimConfidence;
  lastCheckedAt: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface KBVersion {
  id: string;
  entryId: string;
  title: string;
  content: string;
  entryType: KBEntryType;
  tags: string[];
  capabilityStatus: KBCapabilityStatus;
  discoveryNotes?: string;
  lastVerifiedAt?: number;
  createdAt: number;
}

export interface KBEntry {
  id: string;
  workspaceId: string;
  entryType: KBEntryType;
  title: string;
  content: string;
  tags: string[];
  embeddingStatus: KBEmbeddingStatus;
  embeddingError?: string;
  embeddingVersion: number;
  lastVerifiedAt?: number;
  capabilityStatus: KBCapabilityStatus;
  discoveryNotes?: string;
  claims: KBClaim[];
  createdAt: number;
  updatedAt: number;
}

export interface KBContextItem {
  entryId: string;
  entryType: KBEntryType;
  title: string;
  content: string;
  capabilityStatus: KBCapabilityStatus;
  discoveryNotes?: string;
  claims: KBClaim[];
  similarityScore: number;
}

export interface KBContextResult {
  items: KBContextItem[];
  totalTokens: number;
  truncated: boolean;
}
