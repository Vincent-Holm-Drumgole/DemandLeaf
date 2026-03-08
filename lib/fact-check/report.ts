import type {
  FactCheckClaim,
  FactCheckReport,
  KBClaim,
  ResearchBrief,
} from "@/types";
import {
  expectedConfidenceLanguage,
  sentenceMatchesConfidenceLanguage,
} from "@/lib/knowledge-base/claims";
import { splitSentences } from "@/lib/text-utils";

type ClaimReference = {
  id: string;
  entryId?: string;
  statement: string;
  sourceName: string;
  sourceUrl?: string;
  confidence: "verified" | "observed" | "directional";
};

export function buildFactCheckReport(input: {
  content: string;
  knowledgeBaseClaims: Array<KBClaim & { entryTitle?: string }>;
  researchBriefs?: ResearchBrief[];
  reviewedAt?: number;
  reviewedBy?: string;
}): FactCheckReport {
  const claimSentences = splitSentences(input.content).filter((sentence) =>
    /\d/.test(sentence) || /\baccording to\b|\bin our experience\b|\btypically\b/i.test(sentence),
  );

  const researchReferences: ClaimReference[] = (input.researchBriefs ?? []).flatMap((brief, index) =>
    brief.sourceNames.map((sourceName, sourceIndex) => ({
      id: `${brief.id}:${sourceIndex}:${index}`,
      statement: `${brief.title}. ${brief.summary}. ${brief.whyItMatters}`,
      sourceName,
      sourceUrl: brief.sourceUrls[sourceIndex],
      confidence: "verified" as const,
    })),
  );

  const kbReferences: ClaimReference[] = input.knowledgeBaseClaims.map((claim) => ({
    id: claim.id,
    entryId: claim.entryId,
    statement: claim.statement,
    sourceName: claim.sourceName,
    sourceUrl: claim.sourceUrl,
    confidence: claim.confidence,
  }));

  const claims: FactCheckClaim[] = claimSentences.map((sentence, index) => {
    const matchedKb = findBestReference(sentence, kbReferences);
    const matchedResearch = matchedKb ? null : findBestReference(sentence, researchReferences);

    if (matchedKb) {
      const languageMatch = sentenceMatchesConfidenceLanguage(
        sentence,
        matchedKb.confidence,
        matchedKb.sourceName,
      );
      return {
        id: `claim-${index + 1}`,
        text: sentence,
        sentence,
        sourceType: "knowledge_base",
        confidence: matchedKb.confidence,
        sourceName: matchedKb.sourceName,
        sourceUrl: matchedKb.sourceUrl,
        knowledgeBaseEntryId: matchedKb.entryId,
        knowledgeBaseClaimId: matchedKb.id,
        languageMatch,
        verificationStatus: languageMatch ? "verified" : "warning",
        notes: languageMatch
          ? undefined
          : `Expected language cues like: ${expectedConfidenceLanguage(matchedKb.confidence).join(", ")}`,
      };
    }

    if (matchedResearch) {
      return {
        id: `claim-${index + 1}`,
        text: sentence,
        sentence,
        sourceType: "research_source",
        confidence: matchedResearch.confidence,
        sourceName: matchedResearch.sourceName,
        sourceUrl: matchedResearch.sourceUrl,
        languageMatch: true,
        verificationStatus: "verified",
      };
    }

    const inlineUrl = sentence.match(/https?:\/\/[^\s)]+/i)?.[0];
    if (inlineUrl) {
      return {
        id: `claim-${index + 1}`,
        text: sentence,
        sentence,
        sourceType: "inline_citation",
        sourceUrl: inlineUrl,
        languageMatch: true,
        verificationStatus: "verified",
      };
    }

    return {
      id: `claim-${index + 1}`,
      text: sentence,
      sentence,
      sourceType: "unverified",
      languageMatch: false,
      verificationStatus: "unverified",
      notes: "UNVERIFIED - add a source or remove the specific claim",
    };
  });

  return {
    claims,
    reviewedAt: input.reviewedAt,
    reviewedBy: input.reviewedBy,
    unverifiedCount: claims.filter((claim) => claim.verificationStatus === "unverified").length,
    mismatchCount: claims.filter((claim) => !claim.languageMatch).length,
  };
}

function findBestReference(sentence: string, references: ClaimReference[]): ClaimReference | null {
  const sentenceTokens = normalizeTokens(sentence);
  let best: { reference: ClaimReference; score: number } | null = null;

  for (const reference of references) {
    const referenceTokens = normalizeTokens(reference.statement);
    const overlap = [...sentenceTokens].filter((token) => referenceTokens.has(token)).length;
    const numberOverlap = [...sentenceTokens].filter((token) => /\d/.test(token) && referenceTokens.has(token)).length;
    const score = overlap + numberOverlap * 4;
    if (score < 3) continue;
    if (!best || score > best.score) {
      best = { reference, score };
    }
  }

  return best?.reference ?? null;
}

function normalizeTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9.%/\s-]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 || /\d/.test(token)),
  );
}
