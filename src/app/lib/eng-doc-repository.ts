import fs from "fs/promises";
import path from "path";

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
