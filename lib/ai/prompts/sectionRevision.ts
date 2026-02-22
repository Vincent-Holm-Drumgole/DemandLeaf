import type { VoiceProfile } from "@/types";
import { buildBaseSystemPrompt, PROMPT_VERSION } from "./base-system";

export const SECTION_REVISION_VERSION = PROMPT_VERSION;

export interface RevisionFlag {
  paragraphIndex?: number;
  originalText?: string;
  issue: string;
  instruction: string;
}

/**
 * Build prompt for revising specific flagged sections.
 * Uses Layers 1-2 from the draft prompt for consistency.
 */
export function buildSectionRevisionPrompt(
  blogText: string,
  flags: RevisionFlag[],
  voiceProfile: VoiceProfile
): { systemPrompt: string; userMessage: string } {
  const layer1 = buildBaseSystemPrompt();

  const voiceLayer = `Voice Description: ${voiceProfile.voiceDescription}
Formality: ${voiceProfile.formality}/10
Humor: ${voiceProfile.humor}/10
Tone: ${voiceProfile.toneAttributes.join(", ")}`;

  const systemPrompt = `${layer1}

---

VOICE PROFILE:
${voiceLayer}

You are revising specific sections of a blog post. Rewrite ONLY the flagged sections. Keep all other content exactly the same. Match the voice profile precisely.`;

  const localizedFlags = flags.filter(
    (flag) =>
      Number.isInteger(flag.paragraphIndex) &&
      typeof flag.originalText === "string" &&
      flag.originalText.trim().length > 0
  );
  const globalFlags = flags.filter((flag) => !localizedFlags.includes(flag));

  const flagDescriptions = localizedFlags
    .map(
      (f) =>
        `Paragraph ${f.paragraphIndex}: "${f.originalText!.slice(0, 200)}${f.originalText!.length > 200 ? "..." : ""}"
Issue: ${f.issue}
Instruction: ${f.instruction}`
    )
    .join("\n\n") || "None";

  const globalIssueText = globalFlags
    .map((flag, index) => `${index + 1}. ${flag.issue} -> ${flag.instruction}`)
    .join("\n") || "None";

  const userMessage = `FULL BLOG:
${blogText}

SECTIONS TO REVISE:
${flagDescriptions}

GLOBAL ISSUES TO FIX (apply where needed):
${globalIssueText}

Return the complete blog with only the minimum edits needed to fix the listed issues. Do not rewrite unaffected sections.`;

  return { systemPrompt, userMessage };
}
