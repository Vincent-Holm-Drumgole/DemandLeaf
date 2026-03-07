import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthedConvexClient } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { callHaiku, parseJsonResponse } from "@/lib/ai/client";
import { createActiveWorkspaceCookie } from "@/lib/workspace-cookie";

interface SetupBody {
  workspaceName: string;
  companyDescription: string;
  websiteUrl?: string;
  industry: string;
  audienceDescription: string;
  audienceExpertise: string;
  toneAttributes: string[];
  formality: number;
  avoidWords?: string[];
  businessOutcomes?: string;
  seedKeywords?: string[];
  competitorDomains?: string[];
  sessionToken?: string;
}

interface KBEntry {
  entryType: string;
  title: string;
  content: string;
  tags: string[];
}

const KB_GENERATION_PROMPT = `You are a content strategist. Given a company description and audience info, generate 3-5 knowledge base entries that would help an AI write accurate, authentic content for this company.

Each entry should be one of these types: company_info, product, audience, industry, expert_insight

Return a JSON array of entries:
[
  {
    "entryType": "company_info",
    "title": "Short descriptive title",
    "content": "2-3 sentence summary of this knowledge (max 500 chars)",
    "tags": ["tag1", "tag2"]
  }
]

Rules:
- Always include at least one "company_info" entry
- Always include one "audience" entry
- Content should be factual and specific, not generic
- Keep content under 500 characters per entry
- Return ONLY the JSON array, no markdown fences`;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`onboarding-setup:${userId}`, {
    limit: 5,
    windowSec: 3600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
          ),
        },
      }
    );
  }

  let body: SetupBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.companyDescription || body.companyDescription.trim().length < 10) {
    return NextResponse.json(
      { error: "Company description is required (at least 10 characters)" },
      { status: 400 }
    );
  }

  const convex = await getAuthedConvexClient();

  try {
    // 1. Provision workspace
    const { workspaceId, trialActive } = await convex.mutation(api.workspaces.provision, {
      name: (body.workspaceName || "My Workspace").trim().slice(0, 100),
      sessionToken: body.sessionToken?.trim() || undefined,
    });

    // 2. Update workspace profile
    await convex.mutation(api.workspaces.updateProfile, {
      workspaceId,
      url: body.websiteUrl?.trim() || undefined,
      industry: body.industry?.trim() || undefined,
      audienceDescription: body.audienceDescription?.trim() || undefined,
    });

    // 3. Generate KB entries via Haiku
    let kbEntriesCreated = 0;
    try {
      const userMessage = `Company: ${body.companyDescription.trim().slice(0, 1000)}
Industry: ${body.industry || "Not specified"}
Target Audience: ${body.audienceDescription || "Not specified"}
Audience Expertise: ${body.audienceExpertise || "intermediate"}`;

      const aiResult = await callHaiku(KB_GENERATION_PROMPT, userMessage, {
        maxTokens: 2048,
        temperature: 0.4,
      });

      const entries = parseJsonResponse<KBEntry[]>(aiResult.content);

      const VALID_ENTRY_TYPES = ["company_info", "product", "audience", "industry", "expert_insight"] as const;
      type ValidEntryType = (typeof VALID_ENTRY_TYPES)[number];

      if (Array.isArray(entries)) {
        for (const entry of entries.slice(0, 5)) {
          if (
            entry.entryType &&
            VALID_ENTRY_TYPES.includes(entry.entryType as ValidEntryType) &&
            entry.title &&
            entry.content
          ) {
            try {
              await convex.mutation(api.knowledgeBase.create, {
                workspaceId,
                entryType: entry.entryType as ValidEntryType,
                title: String(entry.title).slice(0, 200),
                content: String(entry.content).slice(0, 2000),
                tags: Array.isArray(entry.tags)
                  ? entry.tags.filter((t): t is string => typeof t === "string").slice(0, 10)
                  : [],
              });
              kbEntriesCreated++;
            } catch (e) {
              console.error("[onboarding] KB entry insert error:", e);
            }
          }
        }
      }
    } catch (e) {
      console.error("[onboarding] KB generation error:", e);
      // Non-fatal — continue with setup
    }

    // 4. Create voice profile
    try {
      const toneAttrs = Array.isArray(body.toneAttributes) ? body.toneAttributes : ["professional"];
      const formalityVal = typeof body.formality === "number" ? Math.max(1, Math.min(10, body.formality)) : 5;

      const voiceDesc = `${toneAttrs.join(", ")} tone at formality level ${formalityVal}/10`;

      await convex.mutation(api.voiceProfiles.updateFromWizard, {
        workspaceId,
        patch: {
          voiceDescription: voiceDesc,
          formality: formalityVal,
          humor: toneAttrs.includes("playful") ? 6 : 3,
          jargonLevel: toneAttrs.includes("technical") ? 7 : 4,
          sentenceComplexity: formalityVal >= 7 ? 7 : 5,
          toneAttributes: toneAttrs,
          preferredVocabulary: [],
          avoidedVocabulary: Array.isArray(body.avoidWords) ? body.avoidWords.slice(0, 50) : [],
          writingExamples: [],
          sourceQuality: "none",
        },
      });
    } catch (e) {
      console.error("[onboarding] Voice profile error:", e);
    }

    // 5. Add never-say terms
    if (Array.isArray(body.avoidWords)) {
      for (const word of body.avoidWords.slice(0, 20)) {
        const trimmedWord = typeof word === "string" ? word.trim() : "";
        if (trimmedWord.length > 0 && trimmedWord.length <= 50) {
          try {
            await convex.mutation(api.neverSayList.add, {
              workspaceId,
              term: trimmedWord,
              termType: trimmedWord.includes(" ") ? "phrase" : "word",
            });
          } catch {
            // Duplicate or limit — skip silently
          }
        }
      }
    }

    // 6. Create strategy (if seed keywords provided)
    let strategyId: string | undefined;
    let keywordsDiscovering = false;

    if (Array.isArray(body.seedKeywords) && body.seedKeywords.length > 0) {
      try {
        strategyId = await convex.mutation(api.strategies.create, {
          workspaceId,
          name: `${body.workspaceName || "My"} Content Strategy`,
          businessOutcomes: body.businessOutcomes || "Increase organic traffic and generate leads",
          targetAudience: body.audienceDescription || undefined,
          seedKeywords: body.seedKeywords.slice(0, 20),
        });

        // Fire-and-forget keyword discovery
        if (strategyId) {
          keywordsDiscovering = true;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30_000);
          fetch(`${request.nextUrl.origin}/api/strategy/${strategyId}/discover`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: request.headers.get("cookie") || "",
              "x-workspace-id": workspaceId.toString(),
            },
            body: JSON.stringify({
              competitorDomains: body.competitorDomains?.slice(0, 5) || [],
            }),
            signal: controller.signal,
          }).catch((e) => {
            console.error("[onboarding] Keyword discovery fire-and-forget error:", e);
          }).finally(() => {
            clearTimeout(timeoutId);
          });
        }
      } catch (e) {
        console.error("[onboarding] Strategy creation error:", e);
      }
    }

    const response = NextResponse.json({
      workspaceId: workspaceId.toString(),
      trialActive,
      kbEntriesCreated,
      strategyId: strategyId?.toString(),
      keywordsDiscovering,
    });
    response.cookies.set(createActiveWorkspaceCookie(workspaceId.toString()));
    return response;
  } catch (err) {
    console.error("[onboarding/setup] error:", err);
    return NextResponse.json(
      { error: "Failed to set up workspace" },
      { status: 500 }
    );
  }
}
