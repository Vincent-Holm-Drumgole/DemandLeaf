import type { Archetype } from "@/types";

export interface ArchetypeConfig {
  id: Archetype;
  label: string;
  description: string;
  minWordCount: number;
  maxWordCount: number;
  funnelStage: string;
}

export const ARCHETYPES: Record<Archetype, ArchetypeConfig> = {
  how_to: {
    id: "how_to",
    label: "How-To Guide",
    description: "Step-by-step instructions that solve a specific problem",
    minWordCount: 1200,
    maxWordCount: 3000,
    funnelStage: "Middle",
  },
  listicle: {
    id: "listicle",
    label: "Listicle",
    description: "Curated list with genuine value per item",
    minWordCount: 1200,
    maxWordCount: 2500,
    funnelStage: "Top-Mid",
  },
  definitive_guide: {
    id: "definitive_guide",
    label: "Definitive Guide",
    description: "Comprehensive deep-dive that covers a topic end to end",
    minWordCount: 2500,
    maxWordCount: 5000,
    funnelStage: "Top-Mid",
  },
  thought_leadership: {
    id: "thought_leadership",
    label: "Thought Leadership",
    description: "Opinion piece that establishes a unique POV on an industry topic",
    minWordCount: 800,
    maxWordCount: 2000,
    funnelStage: "Top",
  },
  comparison: {
    id: "comparison",
    label: "Comparison Guide",
    description: "Head-to-head comparison of products, approaches, or strategies",
    minWordCount: 1500,
    maxWordCount: 3000,
    funnelStage: "Bottom",
  },
  data_study: {
    id: "data_study",
    label: "Data Study",
    description: "Data-driven analysis or original research article",
    minWordCount: 1200,
    maxWordCount: 3500,
    funnelStage: "Top-Mid",
  },
  case_study: {
    id: "case_study",
    label: "Case Study",
    description: "Narrative of how a customer or project achieved results",
    minWordCount: 800,
    maxWordCount: 2500,
    funnelStage: "Bottom",
  },
  news_commentary: {
    id: "news_commentary",
    label: "News Commentary",
    description: "Timely take on an industry development or trending topic",
    minWordCount: 600,
    maxWordCount: 1500,
    funnelStage: "Top",
  },
} as const;

export const ARCHETYPE_LIST = Object.values(ARCHETYPES);
