import { EngDoc, loadDocs } from "@/app/lib/eng-doc-repository";
import { searchWithRRF } from "@/app/lib/search-rrf";
import { tool } from "ai";
import z from "zod";

let docs: EngDoc[] | null = null;

export const searchTool = tool({
  description:
    "Search emails using both keywords and semantic search. Returns most relevant emails ranjed by reciprocal ranf fustion",
  inputSchema: z.object({
    keywords: z
      .array(z.string())
      .describe("Exact keywords for BM25 search")
      .optional(),
    searchQuery: z
      .string()
      .describe("Natural language query for semantic search")
      .optional(),
  }),
  execute: async ({ searchQuery, keywords }) => {
    if (!docs) {
      docs = await loadDocs();
    }

    // eslint-disable-next-line no-console
    console.log(`\n\nkeywords => `, keywords);
    console.log(`\n\searchQuery => `, searchQuery);

    const results = await searchWithRRF(docs, searchQuery);

    return {
      documents: results.map(({ doc }) => ({
        content: doc.chunk,
        teamOwner: doc.team,
        name: doc.filename,
      })),
    };
  },
});
