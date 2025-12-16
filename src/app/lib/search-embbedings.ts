import { google } from "@ai-sdk/google";
import { cosineSimilarity, embed } from "ai";
import { EngDoc } from "./eng-doc-repository";
import { getCache, generateCacheKey } from "./cache";

export async function searchWithEmbeddings(
  docs: EngDoc[],
  query: string
): Promise<
  {
    score: number;
    doc: EngDoc;
  }[]
> {
  if (!query) {
    return docs.map((doc) => ({
      doc,
      score: -1,
    }));
  }

  const queryEmbedding = await getCachedEmbeddedQuery(query);

  return docs
    .map((doc) => ({
      doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }))
    .sort((a, b) => b.score - a.score);
}

async function getCachedEmbeddedQuery(query: string) {
  return getCache().wrap(generateCacheKey(query), () =>
    getEmbeddedQuery(query)
  );
}

/**
 * Cached embedding query that uses node-cache-manager with file-based persistence
 * Returns the embedding array for a query, using cache if available
 */
async function getEmbeddedQuery(query: string): Promise<number[]> {
  console.log("Querying textEmbeddingModel");
  if (!query) {
    throw new Error("Query cannot be empty");
  }

  // Generate new embedding
  const res = await embed({
    model: google.textEmbeddingModel(process.env.GOOGLE_EMBEDDING_MODEL!),
    value: query,
  });

  return res.embedding;
}
