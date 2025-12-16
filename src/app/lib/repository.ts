import fs from "fs/promises";
import path from "path";
import { EngDoc } from "./search-bm25";

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
