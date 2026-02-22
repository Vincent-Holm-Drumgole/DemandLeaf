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
} as const;

export const ARCHETYPE_LIST = Object.values(ARCHETYPES);
