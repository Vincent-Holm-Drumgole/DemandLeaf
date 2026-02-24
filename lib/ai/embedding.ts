import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_INPUT_CHARS = 8000; // ~2000 tokens, safe limit

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

/**
 * Generate a 1536-dimensional embedding for the given text.
 * Input is truncated to MAX_INPUT_CHARS to stay within token limits.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const input = text.slice(0, MAX_INPUT_CHARS);
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  if (!response.data.length || !response.data[0].embedding) {
    throw new Error("Empty embedding response from OpenAI");
  }
  return response.data[0].embedding;
}

export { EMBEDDING_DIMENSIONS };
