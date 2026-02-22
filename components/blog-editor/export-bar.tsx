"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useBlogStore } from "@/store/blog-store";

interface ExportBarProps {
  blogId: string;
}

export function ExportBar({ blogId }: ExportBarProps) {
  const { exportBlog } = useBlogStore();
  const [copied, setCopied] = useState(false);

  async function handleExport(format: "html" | "markdown" | "clipboard") {
    const result = await exportBlog(blogId, format);
    if (format === "clipboard" && result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("clipboard")}
      >
        {copied ? "Copied!" : "Copy to Clipboard"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("html")}
      >
        Export HTML
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("markdown")}
      >
        Export Markdown
      </Button>
    </div>
  );
}
