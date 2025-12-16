import BM25 from "okapibm25";
import fs from "fs/promises";
import path from "path";

interface EngDoc {
  id: string;
  hash: string;
  importedAt: string;
  content: string;
  team: string;
  keywords: string[];
  filename: string;
}

export async function loadDocs(): Promise<EngDoc[]> {
  const filePath = path.join(
    process.cwd(),
    "data",
    "eng-docs",
    "eng-docs.json"
  );
  const fileContent = await fs.readFile(filePath, "utf-8");
  return JSON.parse(fileContent) as EngDoc[];
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
