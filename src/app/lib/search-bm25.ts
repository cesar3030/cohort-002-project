import BM25 from "okapibm25";
import { EngDoc } from "./eng-doc-repository";

export function searchWithBM25(
  docs: EngDoc[],
  query: string
): {
  score: number;
  doc: EngDoc;
}[] {
  const keywords = query.length > 0 ? query.split(" ") : [];
  if (keywords.length === 0) {
    return docs.map((doc) => ({
      doc,
      score: -1,
    }));
  }
  const scores: number[] = (BM25 as any)(
    docs.map((doc) => doc.content.toLowerCase()),
    keywords.map((k) => k.toLowerCase())
  );

  return scores
    .map((score, index) => ({
      score,
      doc: docs[index]!,
    }))
    .sort((a, b) => b.score - a.score);
}
