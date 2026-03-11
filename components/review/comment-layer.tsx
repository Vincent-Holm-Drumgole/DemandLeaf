"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Plus, Loader2, Filter } from "lucide-react";
import { CommentThread, type ReviewComment } from "./comment-thread";

interface CommentLayerProps {
  blogId: string;
}

export function CommentLayer({ blogId }: CommentLayerProps) {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [newCommentOpen, setNewCommentOpen] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [newParagraphIndex, setNewParagraphIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/blog/${blogId}/reviews`);
      if (!res.ok) return;
      const data = await res.json();
      setComments(data.comments ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [blogId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleAddComment = async () => {
    if (!newBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/blog/${blogId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anchorParagraphIndex: newParagraphIndex,
          body: newBody.trim(),
        }),
      });
      if (res.ok) {
        setNewBody("");
        setNewCommentOpen(false);
        setNewParagraphIndex(0);
        await fetchComments();
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, body: string) => {
    const parent = comments.find((c) => c._id === parentId);
    await fetch(`/api/blog/${blogId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anchorParagraphIndex: parent?.anchorParagraphIndex ?? 0,
        body,
        parentId,
      }),
    });
    await fetchComments();
  };

  const handleResolve = async (commentId: string) => {
    await fetch(`/api/blog/${blogId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve" }),
    });
    await fetchComments();
  };

  const handleResolveSuggestion = async (commentId: string, accept: boolean) => {
    await fetch(`/api/blog/${blogId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve_suggestion", accept }),
    });
    await fetchComments();
  };

  // Group comments: top-level (no parentId) and replies
  const topLevel = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => !!c.parentId);
  const repliesByParent = new Map<string, ReviewComment[]>();
  for (const r of replies) {
    const existing = repliesByParent.get(r.parentId!) ?? [];
    existing.push(r);
    repliesByParent.set(r.parentId!, existing);
  }

  const unresolvedCount = topLevel.filter((c) => !c.resolved).length;
  const filtered = showResolved ? topLevel : topLevel.filter((c) => !c.resolved);

  // Sort by paragraph index, then by creation time
  filtered.sort((a, b) => a.anchorParagraphIndex - b.anchorParagraphIndex || a.createdAt - b.createdAt);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Comments
            {unresolvedCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {unresolvedCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setShowResolved(!showResolved)}
            >
              <Filter className="mr-1 h-3 w-3" />
              {showResolved ? "Hide resolved" : "Show all"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setNewCommentOpen(!newCommentOpen)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* New comment form */}
        {newCommentOpen && (
          <div className="space-y-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Paragraph #</label>
              <input
                type="number"
                min={0}
                value={newParagraphIndex}
                onChange={(e) => setNewParagraphIndex(parseInt(e.target.value) || 0)}
                className="h-6 w-16 rounded border px-1.5 text-xs"
              />
            </div>
            <Textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[60px] text-xs resize-none"
            />
            <div className="flex justify-end gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  setNewCommentOpen(false);
                  setNewBody("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 text-xs"
                disabled={!newBody.trim() || submitting}
                onClick={handleAddComment}
              >
                {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Comment
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            {topLevel.length === 0 ? "No comments yet" : "All comments resolved"}
          </p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {filtered.map((comment) => (
                <CommentThread
                  key={comment._id}
                  comment={comment}
                  replies={repliesByParent.get(comment._id) ?? []}
                  blogId={blogId}
                  onReply={handleReply}
                  onResolve={handleResolve}
                  onResolveSuggestion={handleResolveSuggestion}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
