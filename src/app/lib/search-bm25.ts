import BM25 from "okapibm25";

export interface EngDoc {
  id: string;
  hash: string;
  importedAt: string;
  content: string;
  team: string;
  keywords: string[];
  filename: string;
  embedding: number[];
}

export function searchWithBM25(
  docs: EngDoc[],
  keywords: string[]
): {
  score: number;
  doc: EngDoc;
}[] {
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
