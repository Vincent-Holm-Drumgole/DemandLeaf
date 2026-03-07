import {
  MAX_KB_CONTENT_CHARS,
  MAX_KB_EMBED_CHUNK_CHARS,
} from "./constants";

export interface KnowledgeBaseContentChunk {
  chunkIndex: number;
  content: string;
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function splitOversizedBlock(block: string, maxChars: number): string[] {
  const normalized = block.trim();
  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const pieces: string[] = [];
  let remaining = normalized;

  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars + 1);
    const sentenceBoundary = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
    );
    const lineBoundary = window.lastIndexOf("\n");
    const splitAt = Math.max(sentenceBoundary, lineBoundary);

    const safeSplitAt = splitAt > Math.floor(maxChars * 0.6) ? splitAt + 1 : maxChars;
    pieces.push(remaining.slice(0, safeSplitAt).trim());
    remaining = remaining.slice(safeSplitAt).trim();
  }

  if (remaining.length > 0) {
    pieces.push(remaining);
  }

  return pieces;
}

function splitIntoParagraphAwareChunks(text: string, maxChars: number): string[] {
  const normalized = normalizeNewlines(text);
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const blocks = normalized
    .split(/\n{2,}/)
    .flatMap((block) => splitOversizedBlock(block, maxChars))
    .filter((block) => block.length > 0);

  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = block;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export function splitKnowledgeBaseEntryContent(content: string): string[] {
  return splitIntoParagraphAwareChunks(content, MAX_KB_CONTENT_CHARS);
}

export function buildKnowledgeBaseEmbeddingChunks(content: string): KnowledgeBaseContentChunk[] {
  return splitIntoParagraphAwareChunks(content, MAX_KB_EMBED_CHUNK_CHARS).map((chunk, index) => ({
    chunkIndex: index,
    content: chunk,
  }));
}
