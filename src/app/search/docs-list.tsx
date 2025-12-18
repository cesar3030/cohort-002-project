"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MailIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";

export type EngDocDisplay = {
  id: string;
  team: string;
  preview: string;
  chunk: string;
  importedAt: string;
  filename: string;
  chunkIndex: number;
  totalChunks: number;
  score: number;
};

function EngDocCard({ engDoc }: { engDoc: EngDocDisplay }) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-1.5 rounded-full bg-primary/10">
          <MailIcon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base mb-0.5">
                {engDoc.filename} (chunk {engDoc.chunkIndex + 1} of{" "}
                {engDoc.totalChunks})
              </h3>
              <p className="text-xs text-muted-foreground">{engDoc.team}</p>
              <p className="text-xs text-muted-foreground">
                Score: {engDoc.score.toFixed(2)}
              </p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDate(engDoc.importedAt)}
            </span>
          </div>

          <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
            {engDoc.preview}
          </p>

          {expanded && (
            <div className="mt-3 pt-3 border-t">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {engDoc.chunk}
                </pre>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 h-8 text-primary hover:text-primary px-2"
          >
            {expanded ? (
              <>
                <ChevronUpIcon className="h-3.5 w-3.5 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDownIcon className="h-3.5 w-3.5 mr-1" />
                See more
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function EngDocList({ engDocs }: { engDocs: EngDocDisplay[] }) {
  if (engDocs.length === 0) {
    return (
      <div className="text-center py-12">
        <MailIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No document found</h3>
        <p className="text-muted-foreground">Try adjusting your search query</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {engDocs.map((engDoc) => (
        <EngDocCard key={engDoc.id} engDoc={engDoc} />
      ))}
    </div>
  );
}
