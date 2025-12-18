import { TopBar } from "@/components/top-bar";
import { SearchInput } from "./search-input";
import { SearchPagination } from "./search-pagination";
import { PerPageSelector } from "./per-page-selector";

import { loadChats, loadMemories } from "@/lib/persistence-layer";
import { CHAT_LIMIT } from "../page";
import { SideBar } from "@/components/side-bar";
import { EngDocList } from "./docs-list";
import { loadDocs } from "../lib/eng-doc-repository";

import { searchWithRRF } from "../lib/search-rrf";

export default async function SearchPage(props: {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams.q || "";
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 10;

  const allDocs = await loadDocs();

  const keywords = query.length > 0 ? query.split(" ") : undefined; // should generate a list of keyword from an llm call
  const filteredDocs = await searchWithRRF(allDocs, query, keywords);

  const transformedDocs = filteredDocs.map(({ score, doc }) => ({
    id: doc.id,
    team: doc.team,
    preview: doc.chunk.substring(0, 100) + "...",
    chunk: doc.chunk,
    importedAt: doc.importedAt,
    filename: doc.filename,
    chunkIndex: doc.chunkIndex,
    totalChunks: doc.totalChunks,
    score,
  }));

  const totalPages = Math.ceil(transformedDocs.length / perPage);
  const startIndex = (page - 1) * perPage;
  const paginatedDocs = transformedDocs.slice(startIndex, startIndex + perPage);
  const allChats = await loadChats();
  const chats = allChats.slice(0, CHAT_LIMIT);
  const memories = await loadMemories();

  return (
    <>
      <SideBar chats={chats} memories={memories} chatIdFromSearchParams={""} />
      <div className="h-screen flex flex-col w-full">
        <TopBar showSidebar={true} title="Data" />
        <div className="flex-1">
          <div className="max-w-4xl mx-auto xl:px-2 px-6 py-6">
            <div className="mb-6">
              <p className="text-sm text-muted-foreground">
                Search through your email archive
              </p>
            </div>

            <div className="flex md:items-center md:justify-between gap-4 flex-col md:flex-row">
              <SearchInput initialQuery={query} currentPerPage={perPage} />
              <PerPageSelector currentPerPage={perPage} query={query} />
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  {query ? (
                    <>
                      Found {filteredDocs.length} result
                      {filteredDocs.length !== 1 ? "s" : ""} for &ldquo;
                      {query}
                      &rdquo;
                    </>
                  ) : (
                    <>Found {filteredDocs.length} chunks</>
                  )}
                </p>
              </div>
              <EngDocList engDocs={paginatedDocs} />
              {totalPages > 1 && (
                <div className="mt-6">
                  <SearchPagination
                    currentPage={page}
                    totalPages={totalPages}
                    query={query}
                    perPage={perPage}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
