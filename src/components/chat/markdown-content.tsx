"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
