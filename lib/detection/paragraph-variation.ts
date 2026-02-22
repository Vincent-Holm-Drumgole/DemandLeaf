import type { DetectionFlag } from "@/types";
import { extractParagraphs, countWords } from "@/lib/text-utils";
import {
  PARAGRAPH_SIMILARITY_THRESHOLD,
  MIN_DISTINCT_PARAGRAPH_LENGTHS_PER_500,
  SEVERITY_LOW_PARAGRAPH_VARIATION,
} from "@/lib/constants/detection";

/**
 * Analyze paragraph length variation.
 * Flags when consecutive paragraphs are too similar in length
 * or when there aren't enough distinct paragraph lengths.
 */
export function checkParagraphVariation(content: string): DetectionFlag[] {
  const paragraphs = extractParagraphs(content);
  const flags: DetectionFlag[] = [];

  if (paragraphs.length < 4) return flags;

  const lengths = paragraphs.map((p) => countWords(p));

  // Check for consecutive similar-length paragraphs
  let foundConsecutiveSimilar = false;
  for (let i = 1; i < lengths.length; i++) {
    if (Math.abs(lengths[i] - lengths[i - 1]) <= PARAGRAPH_SIMILARITY_THRESHOLD) {
      foundConsecutiveSimilar = true;
      flags.push({
        algorithm: "paragraph_variation",
        severity: SEVERITY_LOW_PARAGRAPH_VARIATION,
        detail: `2+ consecutive paragraphs with similar length (within ${PARAGRAPH_SIMILARITY_THRESHOLD} words)`,
      });
      break;
    }
  }

  // Check for enough distinct paragraph lengths per 500-word block.
  const blocks = buildWordBlocks(lengths, 500);
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.length < 2) continue;

    const buckets = new Set(block.map((length) => Math.floor(length / 20)));
    const requiredDistinct = Math.min(
      MIN_DISTINCT_PARAGRAPH_LENGTHS_PER_500,
      block.length
    );

    if (buckets.size < requiredDistinct) {
      flags.push({
        algorithm: "paragraph_variation",
        severity: SEVERITY_LOW_PARAGRAPH_VARIATION,
        detail: `Paragraph variation is low in ~500-word block ${i + 1} (${buckets.size}/${requiredDistinct} distinct ranges).`,
      });
      break;
    }
  }

  if (!foundConsecutiveSimilar && flags.length === 0) {
    return [];
  }

  return flags;
}

function buildWordBlocks(lengths: number[], blockSize: number): number[][] {
  const blocks: number[][] = [];
  let currentBlock: number[] = [];
  let currentWordCount = 0;

  for (const length of lengths) {
    currentBlock.push(length);
    currentWordCount += length;

    if (currentWordCount >= blockSize) {
      blocks.push(currentBlock);
      currentBlock = [];
      currentWordCount = 0;
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks;
}
