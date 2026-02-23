export type KBEntryType =
  | "company_info"
  | "product"
  | "audience"
  | "competitor"
  | "industry"
  | "customer_story"
  | "expert_insight"
  | "proprietary_data"
  | "hot_take"
  | "lesson_learned"
  | "methodology"
  | "thought_leadership_position";

export type KBEmbeddingStatus = "pending" | "ready" | "failed";

export interface KBEntry {
  id: string;
  workspaceId: string;
  entryType: KBEntryType;
  title: string;
  content: string;
  tags: string[];
  embeddingStatus: KBEmbeddingStatus;
  createdAt: number;
  updatedAt: number;
}

export interface KBContextItem {
  entryId: string;
  entryType: KBEntryType;
  title: string;
  content: string;
  similarityScore: number;
}

export interface KBContextResult {
  items: KBContextItem[];
  totalTokens: number;
  truncated: boolean;
}
