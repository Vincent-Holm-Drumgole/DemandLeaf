"use client";

import { useState } from "react";
import type { PublicationCheckResult } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface PublicationCheckPanelProps {
  blogId: string;
  publicationCheck: PublicationCheckResult | null;
  onUpdated: (nextValue: PublicationCheckResult) => void;
}

export function PublicationCheckPanel({
  blogId,
  publicationCheck,
  onUpdated,
}: PublicationCheckPanelProps) {
  const [isSaving, setIsSaving] = useState(false);

  async function updateReviewState(patch: {
    factCheckReviewed?: boolean;
    humanApproved?: boolean;
  }) {
    if (!publicationCheck || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/blog/${blogId}/publication-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        throw new Error("Failed to update review state");
      }
      onUpdated(await res.json());
    } finally {
      setIsSaving(false);
    }
  }

  if (!publicationCheck) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Fact Check</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Calculating publication checks…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">Pre-Publish Checklist</CardTitle>
            <Badge variant={publicationCheck.canPublish ? "default" : "secondary"}>
              {publicationCheck.canPublish ? "Publishable" : "Blocked"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ChecklistLine
            label={`Quality score ≥ ${publicationCheck.checklist.minQualityScore}`}
            passed={publicationCheck.checklist.qualityScorePassed}
          />
          <ChecklistLine
            label="Zero unverified claims"
            passed={publicationCheck.checklist.zeroUnverifiedClaims}
          />
          <ChecklistLine
            label="Fact check reviewed"
            passed={publicationCheck.checklist.factCheckReviewed}
          />
          <ChecklistLine
            label="No banned phrases"
            passed={publicationCheck.checklist.bannedTermsPassed}
          />
          <ChecklistLine
            label="At least 3 specific examples"
            passed={publicationCheck.checklist.specificExamplesPassed}
          />
          <ChecklistLine
            label="Unique insight present"
            passed={publicationCheck.checklist.uniqueInsightPassed}
          />
          <ChecklistLine
            label="Human approved"
            passed={publicationCheck.checklist.humanApproved}
          />

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={publicationCheck.checklist.factCheckReviewed ? "secondary" : "default"}
              disabled={isSaving}
              onClick={() =>
                updateReviewState({
                  factCheckReviewed: !publicationCheck.checklist.factCheckReviewed,
                })
              }
            >
              {publicationCheck.checklist.factCheckReviewed
                ? "Unmark Fact Check"
                : "Mark Fact Check Reviewed"}
            </Button>
            <Button
              size="sm"
              variant={publicationCheck.checklist.humanApproved ? "secondary" : "default"}
              disabled={isSaving}
              onClick={() =>
                updateReviewState({
                  humanApproved: !publicationCheck.checklist.humanApproved,
                })
              }
            >
              {publicationCheck.checklist.humanApproved
                ? "Revoke Approval"
                : "Approve for Publish"}
            </Button>
          </div>

          {publicationCheck.killSwitchTriggered && (
            <p className="text-xs text-destructive">
              Kill switch triggered: this draft scored below 50. Regenerate or revise before publishing.
            </p>
          )}
          {publicationCheck.blockers.length > 0 && (
            <ul className="list-disc pl-4 text-xs text-muted-foreground">
              {publicationCheck.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Quality Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <MetricLine label="Specificity" value={publicationCheck.qualityBreakdown.specificity} />
          <MetricLine label="Source integrity" value={publicationCheck.qualityBreakdown.sourceIntegrity} />
          <MetricLine label="Originality" value={publicationCheck.qualityBreakdown.originality} />
          <MetricLine label="Practitioner depth" value={publicationCheck.qualityBreakdown.practitionerDepth} />
          <MetricLine label="Brand voice" value={publicationCheck.qualityBreakdown.brandVoiceAlignment} />
          <MetricLine label="Filler ratio" value={Math.round(publicationCheck.qualityBreakdown.fillerRatio * 100)} suffix="%" />
          <MetricLine label="Repeated openers" value={publicationCheck.qualityBreakdown.openerRepetitionCount} />
          <Separator />
          <p className="text-xs text-muted-foreground">
            Unique insight: {publicationCheck.qualityBreakdown.uniqueInsight.reason}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Fact Check Report</CardTitle>
            <Badge variant="outline">
              {publicationCheck.factCheck.unverifiedCount} unverified
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {publicationCheck.factCheck.claims.length === 0 ? (
            <p className="text-xs text-muted-foreground">No factual claims extracted.</p>
          ) : (
            publicationCheck.factCheck.claims.map((claim) => (
              <div key={claim.id} className="rounded-md border p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant={
                      claim.verificationStatus === "verified"
                        ? "default"
                        : claim.verificationStatus === "warning"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {claim.verificationStatus}
                  </Badge>
                  <span className="text-muted-foreground">
                    {claim.sourceName ?? claim.sourceType.replace(/_/g, " ")}
                  </span>
                </div>
                <p>{claim.sentence}</p>
                {claim.notes && <p className="text-muted-foreground">{claim.notes}</p>}
                {claim.sourceUrl && (
                  <a
                    href={claim.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {claim.sourceUrl}
                  </a>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChecklistLine({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <Badge variant={passed ? "default" : "secondary"}>{passed ? "Pass" : "Needs work"}</Badge>
    </div>
  );
}

function MetricLine({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {value}
        {suffix}
      </span>
    </div>
  );
}
