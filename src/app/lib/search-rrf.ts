import { EngDoc } from "./eng-doc-repository";
import { searchWithBM25 } from "./search-bm25";
import { searchWithEmbeddings } from "./search-embbedings";

// ADDED: RRF parameter for rank fusion
const RRF_K = 60;

export async function searchWithRRF(
  docs: EngDoc[],
  query: string
): Promise<
  {
    score: number;
    doc: EngDoc;
  }[]
> {
  const bm25Results = searchWithBM25(docs, query);
  const embeddingsResults = await searchWithEmbeddings(docs, query);

  return reciprocalRankFusion([bm25Results, embeddingsResults]);
}

// ADDED: Combines multiple ranking lists using position-based scoring
function reciprocalRankFusion(
  rankings: { doc: EngDoc; score: number }[][]
): { doc: EngDoc; score: number }[] {
  const rrfScores = new Map<string, number>();
  const docMap = new Map<string, EngDoc>();

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
