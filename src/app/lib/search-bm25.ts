import BM25 from "okapibm25";
import { EngDocChunk } from "./eng-doc-repository";

export function searchWithBM25(
  docs: EngDocChunk[],
  keywords: string[]
): {
  score: number;
  doc: EngDocChunk;
}[] {
  if (keywords.length === 0) {
    return docs.map((doc) => ({
      doc,
      score: -1,
    }));
  }
  const scores: number[] = (BM25 as any)(
    docs.map((doc) => doc.chunk.toLowerCase()),
    keywords.map((k) => k.toLowerCase())
  );

  return scores
    .map((score, index) => ({
      score,
      doc: docs[index]!,
    }))
    .sort((a, b) => b.score - a.score);
}
