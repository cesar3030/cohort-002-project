import fs from "fs/promises";
import path from "path";

export interface EngDocChunk {
  id: string;
  hash: string;
  importedAt: string;
  team: string;
  keywords: string[];
  filename: string;
  embedding: number[];
  chunk: string;
  chunkIndex: number;
  totalChunks: number;
}

export async function loadDocs(): Promise<EngDocChunk[]> {
  const filePath = path.join(
    process.cwd(),
    "data",
    "eng-docs",
    "eng-docs.json"
  );
  const fileContent = await fs.readFile(filePath, "utf-8");
  return JSON.parse(fileContent) as EngDocChunk[];
}
