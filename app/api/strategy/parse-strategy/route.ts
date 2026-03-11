import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { callSonnet, parseJsonResponse } from "@/lib/ai/client";
import { KB_ENTRY_TYPES } from "@/types/knowledge-base";

export const maxDuration = 120;

const MAX_INPUT_LENGTH = 15_000;

const SYSTEM_PROMPT = `You are a content strategy parser. Given a user's natural language description of their content strategy, extract structured data into the JSON schema below.

## Output Schema
Return a single JSON object with these fields:

{
  "strategyName": "string — concise name for the strategy",
  "businessOutcomes": "string — what the business wants to achieve with content",
  "targetAudience": "string — who they're targeting",
  "seedKeywords": ["string[] — 3-15 core keywords to build the strategy around"],
  "masterContext": "string — background context about the business, its positioning, and what makes it unique",
  "competitors": [{"domain": "example.com", "trackedKeywords": ["keyword1", "keyword2"]}],
  "thoughtLeadershipPositions": ["string[] — opinionated stances or unique perspectives the brand holds"],
  "neverSayTerms": ["string[] — words or phrases the brand should never use"],
  "knowledgeBaseEntries": [{
    "title": "string",
    "content": "string — detailed factual content (2-4 paragraphs)",
    "entryType": "one of: ${KB_ENTRY_TYPES.join(", ")}",
    "tags": ["string[]"]
  }],
  "pillars": [{
    "name": "string — pillar/cluster name",
    "keywords": [{
      "keyword": "string",
      "archetype": "one of: how_to, listicle, definitive_guide, thought_leadership, comparison, data_study, case_study, news_commentary",
      "contentTrack": "one of: evergreen, research, thought_leadership"
    }]
  }],
  "publishSchedule": {
    "postsPerWeek": 2,
    "startDate": "YYYY-MM-DD"
  },
  "missingFields": ["string[] — list any required fields you could not determine from the input"],
  "confidence": "high | medium | low"
}

## Rules
- Extract as much as you can from the input. Infer reasonable defaults for missing optional fields.
- strategyName, businessOutcomes, and seedKeywords are required. If you cannot determine them, include them in missingFields.
- For pillars: group related keywords together. Assign archetypes based on the keyword's intent (e.g. "how to X" → how_to, "X vs Y" → comparison, opinion pieces → thought_leadership).
- Default contentTrack to "evergreen" unless the topic is time-sensitive (research) or opinion-based (thought_leadership).
- Default postsPerWeek to 2 and startDate to next Monday if not specified.
- For knowledgeBaseEntries: extract factual claims about the business, product capabilities, industry insights, or competitive positioning. Use appropriate entryType values.
- For thoughtLeadershipPositions: extract any opinionated or contrarian stances the brand takes.
- For neverSayTerms: extract any mentioned words/phrases to avoid.
- For competitors: extract any competitor domains or company names mentioned. Convert company names to likely domains.
- masterContext should capture the business description, positioning, and unique value proposition.
- Return ONLY the JSON object. No markdown, no explanation.`;

interface ParseResult {
  parsed: Record<string, unknown>;
  missingFields: string[];
  confidence: "high" | "medium" | "low";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = await checkRateLimit(`strategy-parse:${userId}`, { limit: 5, windowSec: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    });
  }

  let body: { input: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.input || typeof body.input !== "string" || body.input.trim().length === 0) {
    return NextResponse.json({ error: "Input text is required" }, { status: 400 });
  }

  const input = body.input.slice(0, MAX_INPUT_LENGTH);

  try {
    const result = await callSonnet(SYSTEM_PROMPT, input, { maxTokens: 8192 });
    const parsed = parseJsonResponse<Record<string, unknown>>(result.content);

    const missingFields = Array.isArray(parsed.missingFields)
      ? (parsed.missingFields as string[])
      : [];
    const confidence = (parsed.confidence as string) ?? "medium";

    delete parsed.missingFields;
    delete parsed.confidence;

    return NextResponse.json({
      parsed,
      missingFields,
      confidence,
      costCents: result.costCents,
    });
  } catch (err) {
    console.error("[strategy/parse-strategy] error:", err);
    const message = err instanceof Error ? err.message : "Failed to parse strategy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
