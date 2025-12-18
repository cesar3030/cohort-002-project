import { EngDocChunk } from "./eng-doc-repository";
import { searchWithBM25 } from "./search-bm25";
import { searchWithEmbeddings } from "./search-embbedings";

// ADDED: RRF parameter for rank fusion
const RRF_K = 60;

export async function searchWithRRF(
  docs: EngDocChunk[],
  query?: string,
  keywords?: string[]
): Promise<{ score: number; doc: EngDocChunk }[]> {
  const bm25Results =
    keywords && keywords.length > 0 ? searchWithBM25(docs, keywords) : [];
  const embeddingsResults = query
    ? await searchWithEmbeddings(docs, query)
    : [];

  if (bm25Results.length === 0 && embeddingsResults.length === 0) {
    return docs.map((doc) => ({
      score: -1,
      doc,
    }));
  }

  return reciprocalRankFusion([
    bm25Results.slice(0, 30),
    embeddingsResults.slice(0, 30),
  ])
    .filter((r) => r.score > 0)
    .slice(0, 10);
}

// ADDED: Combines multiple ranking lists using position-based scoring
function reciprocalRankFusion(
  rankings: { doc: EngDocChunk; score: number }[][]
): { doc: EngDocChunk; score: number }[] {
  const rrfScores = new Map<string, number>();
  const docMap = new Map<string, EngDocChunk>();

  // Process each ranking list (BM25 and embeddings)
  rankings.forEach((ranking) => {
    ranking.forEach((item, rank) => {
      const currentScore = rrfScores.get(item.doc.id) || 0;

      // Position-based scoring: 1/(k+rank)
      const contribution = 1 / (RRF_K + rank);
      rrfScores.set(item.doc.id, currentScore + contribution);

      docMap.set(item.doc.id, item.doc);
    });
  });

  // Sort by combined RRF score descending
  return Array.from(rrfScores.entries())
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .map(([docId, score]) => ({
      score,
      doc: docMap.get(docId)!,
    }));
}
