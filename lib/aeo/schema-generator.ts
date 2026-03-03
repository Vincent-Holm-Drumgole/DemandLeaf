import type { AuthorPersona, SchemaType, SchemaMarkup } from "@/types";
import { stripMarkdown } from "@/lib/text-utils";

export interface SchemaInput {
  title: string;
  metaDescription: string;
  slug: string;
  siteUrl: string;
  content: string; // markdown
  publishedAt?: number; // epoch ms
  authorPersona?: AuthorPersona;
}

/**
 * Generate JSON-LD schema markup. Pure code, zero AI cost.
 *
 * Auto-detects type:
 *  - FAQPage: if FAQ heading + question sub-headings found
 *  - HowTo: if "how to" heading + numbered steps found
 *  - Article: default fallback
 */
export function generateSchema(input: SchemaInput): SchemaMarkup {
  const type = detectSchemaType(input.content);
  const json = buildSchemaJson(type, input);
  return { type, json };
}

export function generateAuthorSchemaJson(persona: AuthorPersona): string {
  return JSON.stringify(buildAuthorObject(persona), null, 2);
}

// ── Internal ────────────────────────────────────────────────────────

function detectSchemaType(content: string): SchemaType {
  if (/^#{1,3}\s+(faq|frequently asked questions)/im.test(content)) {
    return "FAQPage";
  }
  if (/^#{1,3}\s+how to\s/im.test(content)) {
    return "HowTo";
  }
  return "Article";
}

function buildSchemaJson(type: SchemaType, input: SchemaInput): string {
  const {
    title,
    metaDescription,
    slug,
    siteUrl,
    content,
    publishedAt,
    authorPersona,
  } = input;
  const url = `${siteUrl.replace(/\/$/, "")}/${slug}`;
  const datePublished = publishedAt
    ? new Date(publishedAt).toISOString()
    : new Date().toISOString();

  const authorObject = authorPersona
    ? buildAuthorObject(authorPersona)
    : { "@type": "Person" as const, name: "Author" };

  if (type === "FAQPage") {
    const faqs = extractFaqPairs(content);
    return JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        name: title,
        description: metaDescription,
        url,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
        author: authorObject,
        datePublished,
      },
      null,
      2
    );
  }

  if (type === "HowTo") {
    const steps = extractHowToSteps(content);
    return JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: title,
        description: metaDescription,
        url,
        step: steps.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
        author: authorObject,
        datePublished,
      },
      null,
      2
    );
  }

  // Article (default)
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description: metaDescription,
      url,
      author: authorObject,
      datePublished,
      wordCount: (stripMarkdown(content).match(/\S+/g) ?? []).length,
    },
    null,
    2
  );
}

function buildAuthorObject(persona: AuthorPersona) {
  const sameAs = [
    persona.socialUrls?.twitter,
    persona.socialUrls?.linkedin,
    persona.socialUrls?.website,
  ].filter(Boolean);

  return {
    "@type": "Person" as const,
    name: persona.name,
    ...(persona.jobTitle && { jobTitle: persona.jobTitle }),
    ...(persona.bio && { description: persona.bio }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(persona.socialUrls?.website && { url: persona.socialUrls.website }),
  };
}

function extractFaqPairs(
  content: string
): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^#{2,3}\s+(.+\?)$/);
    if (headingMatch) {
      const question = headingMatch[1];
      const answerLines: string[] = [];
      for (
        let j = i + 1;
        j < lines.length && !lines[j].startsWith("#");
        j++
      ) {
        if (lines[j].trim()) answerLines.push(lines[j].trim());
      }
      if (answerLines.length > 0) {
        pairs.push({ question, answer: answerLines.slice(0, 3).join(" ") });
      }
    }
  }

  return pairs;
}

function extractHowToSteps(
  content: string
): { name: string; text: string }[] {
  const steps: { name: string; text: string }[] = [];
  const ordered = content.match(/^\d+\.\s+(.+)$/gm) ?? [];
  for (const step of ordered) {
    const match = step.match(/^\d+\.\s+(.+)$/);
    if (match) steps.push({ name: match[1], text: match[1] });
  }
  return steps;
}
