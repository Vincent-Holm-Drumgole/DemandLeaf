"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface WorkspaceMember {
  _id: string;
  clerkUserId: string;
  role: string;
}

interface RequestReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blogId: string;
  workspaceId: string;
  existingReviewerIds: string[];
  onRequested: () => void;
}

export function RequestReviewDialog({
  open,
  onOpenChange,
  blogId,
  workspaceId,
  existingReviewerIds,
  onRequested,
}: RequestReviewDialogProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(new Set());

    fetch(`/api/blog/${blogId}/reviews?members=true&workspaceId=${workspaceId}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        // Use the workspace members list from the API if available,
        // otherwise we'll need a dedicated endpoint
        if (data.members) {
          setMembers(data.members);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, blogId, workspaceId]);

  const toggle = (clerkUserId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clerkUserId)) next.delete(clerkUserId);
      else next.add(clerkUserId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/blog/${blogId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerClerkUserIds: [...selected] }),
      });
      if (res.ok) {
        onRequested();
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const availableMembers = members.filter(
    (m) => !existingReviewerIds.includes(m.clerkUserId),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Review</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : availableMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {members.length === 0
              ? "No workspace members found"
              : "All members are already assigned as reviewers"}
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {availableMembers.map((member) => (
              <label
                key={member._id}
                className="flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.has(member.clerkUserId)}
                  onChange={() => toggle(member.clerkUserId)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <div className="min-w-0">
                  <p className="text-sm truncate">{member.clerkUserId}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || submitting}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Request Review ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
