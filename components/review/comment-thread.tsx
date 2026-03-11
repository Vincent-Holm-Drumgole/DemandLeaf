"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  ArrowRight,
} from "lucide-react";
function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export interface ReviewComment {
  _id: string;
  blogId: string;
  parentId?: string;
  authorClerkUserId: string;
  anchorParagraphIndex: number;
  anchorText?: string;
  body: string;
  resolved: boolean;
  resolvedByClerkUserId?: string;
  resolvedAt?: number;
  suggestionOriginal?: string;
  suggestionReplacement?: string;
  suggestionStatus?: "pending" | "accepted" | "rejected";
  createdAt: number;
  updatedAt: number;
}

interface CommentThreadProps {
  comment: ReviewComment;
  replies: ReviewComment[];
  blogId: string;
  onReply: (parentId: string, body: string) => Promise<void>;
  onResolve: (commentId: string) => Promise<void>;
  onResolveSuggestion: (commentId: string, accept: boolean) => Promise<void>;
}

export function CommentThread({
  comment,
  replies,
  blogId,
  onReply,
  onResolve,
  onResolveSuggestion,
}: CommentThreadProps) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);

  const isSuggestion = !!comment.suggestionOriginal;

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(comment._id, replyText.trim());
      setReplyText("");
      setShowReply(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await onResolve(comment._id);
    } finally {
      setResolving(false);
    }
  };

  const handleSuggestionDecision = async (accept: boolean) => {
    setResolving(true);
    try {
      await onResolveSuggestion(comment._id, accept);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className={`rounded-md border p-3 text-sm ${comment.resolved ? "opacity-60" : ""}`}>
      {/* Comment header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium">
          {comment.authorClerkUserId.slice(0, 12)}...
        </span>
        <span className="text-[10px] text-muted-foreground">
          {timeAgo(comment.createdAt)}
        </span>
      </div>

      {/* Anchor text */}
      {comment.anchorText && (
        <div className="mb-2 rounded bg-muted/50 px-2 py-1 text-xs italic text-muted-foreground border-l-2 border-primary/30">
          &ldquo;{comment.anchorText.slice(0, 120)}&rdquo;
        </div>
      )}

      {/* Comment body */}
      <p className="text-sm whitespace-pre-wrap">{comment.body}</p>

      {/* Suggestion diff */}
      {isSuggestion && comment.suggestionOriginal && comment.suggestionReplacement && (
        <div className="mt-2 rounded border bg-muted/30 p-2 space-y-1">
          <div className="flex items-start gap-1.5">
            <span className="text-xs text-red-500 line-through">{comment.suggestionOriginal}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowRight className="h-3 w-3 text-green-600 shrink-0" />
            <span className="text-xs text-green-600">{comment.suggestionReplacement}</span>
          </div>
          {comment.suggestionStatus === "pending" && !comment.resolved && (
            <div className="flex gap-1.5 mt-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-green-600"
                disabled={resolving}
                onClick={() => handleSuggestionDecision(true)}
              >
                {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                Accept
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-red-600"
                disabled={resolving}
                onClick={() => handleSuggestionDecision(false)}
              >
                <XCircle className="mr-1 h-3 w-3" />
                Reject
              </Button>
            </div>
          )}
          {comment.suggestionStatus && comment.suggestionStatus !== "pending" && (
            <Badge variant={comment.suggestionStatus === "accepted" ? "default" : "secondary"} className="text-[10px] mt-1">
              {comment.suggestionStatus}
            </Badge>
          )}
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-2 ml-3 border-l-2 border-muted pl-3 space-y-2">
          {replies.map((reply) => (
            <div key={reply._id}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-medium">
                  {reply.authorClerkUserId.slice(0, 12)}...
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {timeAgo(reply.createdAt)}
                </span>
              </div>
              <p className="text-xs whitespace-pre-wrap">{reply.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {!comment.resolved && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setShowReply(!showReply)}
          >
            <MessageSquare className="mr-1 h-3 w-3" />
            Reply
          </Button>
          {!isSuggestion && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              disabled={resolving}
              onClick={handleResolve}
            >
              {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resolve"}
            </Button>
          )}
        </div>
      )}

      {comment.resolved && (
        <Badge variant="secondary" className="mt-2 text-[10px]">Resolved</Badge>
      )}

      {/* Reply input */}
      {showReply && (
        <div className="mt-2 space-y-1.5">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            className="min-h-[60px] text-xs resize-none"
          />
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowReply(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-6 text-xs" disabled={!replyText.trim() || submitting} onClick={handleReply}>
              {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
