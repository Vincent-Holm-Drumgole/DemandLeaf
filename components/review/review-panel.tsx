"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Users,
  Loader2,
} from "lucide-react";
import { RequestReviewDialog } from "./request-review-dialog";
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

interface ReviewRequest {
  _id: string;
  reviewerClerkUserId: string;
  requestedByClerkUserId: string;
  status: "pending" | "approved" | "changes_requested";
  note?: string;
  decidedAt?: number;
  createdAt: number;
}

interface ActivityItem {
  _id: string;
  actorClerkUserId: string;
  action: string;
  detail?: string;
  createdAt: number;
}

interface ReviewStatus {
  total: number;
  approved: number;
  pending: number;
  changesRequested: number;
  allApproved: boolean;
}

interface ReviewPanelProps {
  blogId: string;
  workspaceId: string;
  onDecisionSubmitted?: () => void;
}

const statusIcon = {
  pending: <Clock className="h-3.5 w-3.5 text-yellow-500" />,
  approved: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  changes_requested: <XCircle className="h-3.5 w-3.5 text-red-500" />,
};

const statusLabel = {
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes Requested",
};

export function ReviewPanel({ blogId, workspaceId, onDecisionSubmitted }: ReviewPanelProps) {
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<ReviewStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch(`/api/blog/${blogId}/reviews`);
      if (!res.ok) return;
      const data = await res.json();
      setRequests(data.requests ?? []);
      setActivity(data.activity ?? []);
      setStatus(data.status ?? null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [blogId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDecision = async (requestId: string, decision: "approved" | "changes_requested", note?: string) => {
    setSubmitting(requestId);
    try {
      const res = await fetch(`/api/blog/${blogId}/reviews/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewRequestId: requestId, status: decision, note }),
      });
      if (res.ok) {
        await fetchReviews();
        onDecisionSubmitted?.();
      }
    } catch {
      // silent
    } finally {
      setSubmitting(null);
    }
  };

  const handleReviewRequested = async () => {
    setDialogOpen(false);
    await fetchReviews();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              Review
            </CardTitle>
            {status && status.total > 0 && (
              <Badge variant={status.allApproved ? "default" : "secondary"} className="text-xs">
                {status.approved}/{status.total} approved
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setDialogOpen(true)}
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Request Review
          </Button>

          {requests.length > 0 && (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req._id} className="flex items-center justify-between rounded-md border px-2.5 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon[req.status]}
                    <span className="text-xs truncate">
                      {req.reviewerClerkUserId.slice(0, 12)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {req.status === "pending" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-green-600 hover:text-green-700"
                          disabled={submitting === req._id}
                          onClick={() => handleDecision(req._id, "approved")}
                        >
                          {submitting === req._id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Approve"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                          disabled={submitting === req._id}
                          onClick={() => handleDecision(req._id, "changes_requested")}
                        >
                          Request Changes
                        </Button>
                      </>
                    )}
                    {req.status !== "pending" && (
                      <span className="text-[10px] text-muted-foreground">
                        {statusLabel[req.status]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activity.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Activity
                </p>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1.5">
                    {activity.slice(0, 20).map((item) => (
                      <div key={item._id} className="text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {item.action.replace(/_/g, " ")}
                        </span>
                        {item.detail && (
                          <span className="ml-1 text-muted-foreground">
                            — {item.detail.slice(0, 80)}
                          </span>
                        )}
                        <span className="ml-1 text-muted-foreground/60">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}

          {requests.length === 0 && activity.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No reviews requested yet
            </p>
          )}
        </CardContent>
      </Card>

      <RequestReviewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        blogId={blogId}
        workspaceId={workspaceId}
        existingReviewerIds={requests.map((r) => r.reviewerClerkUserId)}
        onRequested={handleReviewRequested}
      />
    </>
  );
}
