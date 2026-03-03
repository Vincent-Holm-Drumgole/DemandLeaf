"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

interface DecayAlertCardProps {
  alert: {
    id: string;
    blogId: string;
    alertType: string;
    severity: string;
    triggeredAt: number;
    status: string;
    deltaPercent: number;
    diagnosisCause: string | null;
  };
  blogTitle: string;
  onAcknowledge?: (alertId: string) => void;
  onDiagnose?: (alertId: string) => void;
  onRefresh?: (alertId: string, blogId: string) => void;
}

const ALERT_LABELS: Record<string, string> = {
  rank_drop: "Rank Drop",
  traffic_decline: "Traffic Decline",
  ctr_decline: "CTR Decline",
  impressions_decline: "Impressions Decline",
};

const CAUSE_LABELS: Record<string, string> = {
  content_freshness: "Content Freshness",
  serp_feature_loss: "SERP Feature Lost",
  competitor_improvement: "Competitor Improvement",
  technical_issue: "Technical Issue",
  intent_mismatch: "Intent Mismatch",
  authority_gap: "Authority Gap",
};

export function DecayAlertCard({
  alert,
  blogTitle,
  onAcknowledge,
  onDiagnose,
  onRefresh,
}: DecayAlertCardProps) {
  return (
    <Card className={alert.severity === "critical" ? "border-red-300" : ""}>
      <CardContent className="pt-3 pb-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle
                className={`h-3.5 w-3.5 shrink-0 ${
                  alert.severity === "critical"
                    ? "text-red-500"
                    : "text-yellow-500"
                }`}
              />
              <Badge
                variant={
                  alert.severity === "critical" ? "destructive" : "secondary"
                }
                className="text-[10px]"
              >
                {alert.severity}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {ALERT_LABELS[alert.alertType] ?? alert.alertType}
              </span>
              <span className="text-xs font-medium">
                {alert.deltaPercent > 0 ? "+" : ""}
                {alert.deltaPercent}%
              </span>
            </div>
            <p className="text-sm font-medium truncate">{blogTitle}</p>
            {alert.diagnosisCause && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Cause: {CAUSE_LABELS[alert.diagnosisCause] ?? alert.diagnosisCause}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            {alert.status === "open" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px]"
                  onClick={() => onAcknowledge?.(alert.id)}
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Ack
                </Button>
                {!alert.diagnosisCause && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => onDiagnose?.(alert.id)}
                  >
                    Diagnose
                  </Button>
                )}
              </>
            )}
            {(alert.status === "open" || alert.status === "acknowledged") && (
              <Button
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => onRefresh?.(alert.id, alert.blogId)}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Refresh
              </Button>
            )}
            {alert.status === "escalated" && (
              <Badge variant="destructive" className="text-[10px]">
                Escalated
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
