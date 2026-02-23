export interface SEOCheckDefinition {
  name: string;
  maxPoints: number;
  description: string;
}

export const SEO_CHECKS: SEOCheckDefinition[] = [
  { name: "Keyword in title", maxPoints: 10, description: "Focus keyword appears in the blog title" },
  { name: "Keyword in first 10%", maxPoints: 8, description: "Focus keyword appears in the first 10% of content" },
  { name: "Keyword in meta description", maxPoints: 8, description: "Focus keyword appears in the meta description" },
  { name: "Keyword in URL/slug", maxPoints: 7, description: "Focus keyword appears in the URL slug" },
  { name: "Keyword in H2", maxPoints: 7, description: "Focus keyword appears in at least one H2 heading" },
  { name: "Keyword density", maxPoints: 8, description: "Keyword density is between 0.5% and 1.5%" },
  { name: "Title length", maxPoints: 5, description: "SEO title is 50-60 characters" },
  { name: "Meta description length", maxPoints: 5, description: "Meta description is 120-155 characters" },
  { name: "H2 count", maxPoints: 5, description: "Content has at least 2 H2 headings" },
  { name: "Content length", maxPoints: 5, description: "Content is at least 1,000 words" },
  { name: "Short paragraphs", maxPoints: 4, description: "Average paragraph length is under 4 sentences" },
  { name: "Flesch readability", maxPoints: 4, description: "Flesch reading ease score is 50-70" },
  { name: "Heading hierarchy", maxPoints: 4, description: "Headings follow H1 > H2 > H3 hierarchy" },
  { name: "Clean slug", maxPoints: 4, description: "URL slug is 3-5 words, lowercase, hyphenated" },
  { name: "Subheading frequency", maxPoints: 4, description: "Subheadings appear at least every 300 words" },
  { name: "Meta title unique", maxPoints: 4, description: "Meta title contains more than just the keyword" },
];

export const SEO_MAX_POINTS = SEO_CHECKS.reduce((sum, c) => sum + c.maxPoints, 0);

export const SEO_PASS_THRESHOLD = 80;

export const KEYWORD_DENSITY_MIN = 0.005;
export const KEYWORD_DENSITY_MAX = 0.015;
export const TITLE_LENGTH_MIN = 50;
export const TITLE_LENGTH_MAX = 60;
export const META_DESC_LENGTH_MIN = 120;
export const META_DESC_LENGTH_MAX = 155;
export const MIN_H2_COUNT = 2;
export const MIN_CONTENT_WORDS = 1000;
export const MAX_AVG_PARAGRAPH_SENTENCES = 4;
export const FLESCH_MIN = 50;
export const FLESCH_MAX = 70;
export const SUBHEADING_INTERVAL_WORDS = 300;
export const SLUG_MIN_WORDS = 3;
export const SLUG_MAX_WORDS = 5;
