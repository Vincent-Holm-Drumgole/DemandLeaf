"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Check, X, Loader2 } from "lucide-react";
import type { AgentType, AgentActionStatus } from "@/types";

const AGENT_LABELS: Record<AgentType, string> = {
  calendar: "Calendar",
  refresh: "Refresh",
  internal_links: "Links",
  competitive_response: "Competitive",
  strategy_drift: "Strategy",
  publishing: "Publishing",
};

const STATUS_VARIANTS: Record<
  AgentActionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "default",
  approved: "secondary",
  rejected: "destructive",
  executing: "secondary",
  done: "outline",
  failed: "destructive",
};

interface AgentActionCardProps {
  action: {
    id: string;
    agentType: AgentType;
    status: AgentActionStatus;
    reasoning: string;
    suggestedAt: number;
    decidedAt: number | null;
  };
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, note?: string) => Promise<void>;
  children?: React.ReactNode;
}

export function AgentActionCard({
  action,
  onApprove,
  onReject,
  children,
}: AgentActionCardProps) {
  const [expanded, setExpanded] = useState(action.status === "pending");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  async function handleApprove() {
    setApproving(true);
    try {
      await onApprove(action.id);
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    try {
      await onReject(action.id, rejectNote || undefined);
      setShowRejectInput(false);
    } finally {
      setRejecting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <Badge variant="outline" className="text-[10px]">
              {AGENT_LABELS[action.agentType]}
            </Badge>
            <CardTitle className="text-sm">
              {action.reasoning.split("\n")[0].replace(/^#+\s*/, "").slice(0, 60)}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={STATUS_VARIANTS[action.status]}
              className="text-[10px]"
            >
              {action.status}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {new Date(action.suggestedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground whitespace-pre-line">
            {action.reasoning}
          </p>

          {children}

          {action.status === "pending" && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={approving || rejecting}
              >
                {approving ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Check className="mr-1 h-3 w-3" />
                )}
                Approve
              </Button>
              {showRejectInput ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    placeholder="Reason (optional)"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={rejecting}
                  >
                    {rejecting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Reject
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRejectInput(true)}
                  disabled={approving}
                >
                  <X className="mr-1 h-3 w-3" />
                  Reject
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
