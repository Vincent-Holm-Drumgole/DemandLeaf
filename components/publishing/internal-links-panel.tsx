"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Link2 } from "lucide-react";

interface LinkSuggestion {
  _id?: string;
  targetBlogId: string;
  targetTitle: string;
  targetSlug: string;
  anchorText: string;
  similarity: number;
  status?: string;
}

interface InternalLinksPanelProps {
  blogId: string;
  suggestions: LinkSuggestion[];
  onStatusChange?: (linkId: string, status: "accepted" | "rejected") => void;
}

export function InternalLinksPanel({
  blogId,
  suggestions,
  onStatusChange,
}: InternalLinksPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkSuggestion[]>(suggestions);

  useEffect(() => {
    setLinks(suggestions);
  }, [suggestions]);

  async function handleFindLinks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blog/${blogId}/internal-links`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setLinks(
          data.suggestions.map((s: LinkSuggestion) => ({
            ...s,
            status: "suggested",
          }))
        );
      } else {
        setError("Failed to find links. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleAccept(link: LinkSuggestion) {
    if (link._id) onStatusChange?.(link._id, "accepted");
    setLinks((prev) =>
      prev.map((l) =>
        l.targetBlogId === link.targetBlogId
          ? { ...l, status: "accepted" }
          : l
      )
    );
  }

  function handleReject(link: LinkSuggestion) {
    if (link._id) onStatusChange?.(link._id, "rejected");
    setLinks((prev) =>
      prev.map((l) =>
        l.targetBlogId === link.targetBlogId
          ? { ...l, status: "rejected" }
          : l
      )
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Internal Links</CardTitle>
          {links.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {links.filter((l) => l.status !== "rejected").length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
        {links.length === 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleFindLinks}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Link2 className="mr-1 h-3 w-3" />
            )}
            Find Internal Links
          </Button>
        ) : (
          <>
            <div className="space-y-1.5">
              {links
                .filter((l) => l.status !== "rejected")
                .map((link) => (
                  <div
                    key={link.targetBlogId}
                    className="flex items-start gap-1.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {link.anchorText}
                      </p>
                      <p className="text-muted-foreground truncate">
                        → {link.targetTitle}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      {link.status === "accepted" ? (
                        <Badge
                          variant="secondary"
                          className="text-[9px] text-green-600"
                        >
                          Added
                        </Badge>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => handleAccept(link)}
                          >
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => handleReject(link)}
                          >
                            <X className="h-3 w-3 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={handleFindLinks}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Refresh
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
