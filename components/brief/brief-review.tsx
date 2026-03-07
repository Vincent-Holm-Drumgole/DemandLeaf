"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";
import { CannibalizationWarning } from "./cannibalization-warning";
import type { BriefData, OutlineSection } from "@/types";

interface BriefReviewProps {
  briefId: string;
  briefData: BriefData;
  status: string;
}

function EditableSection({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    setDraft(value);
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <div className="font-medium text-sm text-muted-foreground">{label}</div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-[80px]"
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => { onSave(draft); setEditing(false); }}
          >
            <Check className="h-3 w-3 mr-1" /> Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setDraft(value); setEditing(false); }}
          >
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm text-muted-foreground">{label}</div>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={startEditing}
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
      <p className="text-sm mt-1">{value}</p>
    </div>
  );
}

function OutlineDisplay({ outline }: { outline: OutlineSection[] }) {
  return (
    <div className="space-y-1">
      {outline.map((section, i) => (
        <div
          key={i}
          className={`text-sm ${section.level === 3 ? "pl-4 text-muted-foreground" : "font-medium"}`}
        >
          {`H${section.level}: `}
          {section.heading}
        </div>
      ))}
    </div>
  );
}

export function BriefReview({ briefId, briefData, status }: BriefReviewProps) {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();

  const [modifications, setModifications] = useState<Partial<BriefData>>({});
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const data: BriefData = { ...briefData, ...modifications };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/brief/${briefId}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modifications: Object.keys(modifications).length > 0 ? modifications : undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to approve brief");
      }
      router.refresh();
    } catch (err) {
      // TODO: surface error to user (e.g., toast notification)
      console.error("Approve failed:", err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/brief/${briefId}/reject`, { method: "PUT" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to reject brief");
      }
      if (currentWorkspace?._id) {
        router.push(buildWorkspacePath(currentWorkspace._id, "/keywords"));
      }
    } catch (err) {
      // TODO: surface error to user (e.g., toast notification)
      console.error("Reject failed:", err);
    } finally {
      setIsRejecting(false);
    }
  };

  const updateField = <K extends keyof BriefData>(key: K, value: BriefData[K]) => {
    setModifications((m) => ({ ...m, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Cannibalization warning */}
      {data.cannibalizationNote && (
        <CannibalizationWarning
          note={data.cannibalizationNote}
          onOverride={() => updateField("cannibalizationNote", undefined)}
        />
      )}

      {/* Status badge */}
      <div className="flex items-center justify-between">
        <Badge
          variant={status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"}
        >
          {status}
        </Badge>
        {status === "draft" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleReject}
              disabled={isRejecting}
            >
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button onClick={handleApprove} disabled={isApproving}>
              <CheckCircle className="h-4 w-4 mr-1" />
              {isApproving ? "Approving…" : "Approve Brief"}
            </Button>
          </div>
        )}
        {status === "approved" && (
          <Button
            disabled={!currentWorkspace?._id}
            onClick={() => currentWorkspace?._id && router.push(buildWorkspacePath(currentWorkspace._id, "/dashboard"))}
          >
            Generate Blog Post
          </Button>
        )}
      </div>

      <Separator />

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Search Volume", value: data.searchVolume?.toLocaleString() ?? "—" },
          { label: "Keyword Difficulty", value: data.keywordDifficulty?.toString() ?? "—" },
          { label: "CPC", value: data.cpc !== undefined ? `$${data.cpc.toFixed(2)}` : "—" },
          { label: "Opportunity Score", value: data.opportunityScore !== undefined ? Math.round(data.opportunityScore).toLocaleString() : "—" },
        ].map((m) => (
          <div key={m.label} className="rounded-lg bg-muted p-3">
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="font-semibold">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Strategic Direction</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground font-medium">Target Keyword</div>
              <p className="font-semibold">{data.targetKeyword}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground font-medium">Search Intent</div>
                <Badge variant="secondary">{data.searchIntent}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground font-medium">Buyer Stage</div>
                <Badge variant="outline">{data.buyerStage}</Badge>
              </div>
            </div>
            <EditableSection
              label="Content Gap"
              value={data.contentGap}
              onSave={(v) => updateField("contentGap", v)}
            />
            <EditableSection
              label="Unique Angle"
              value={data.uniqueAngle}
              onSave={(v) => updateField("uniqueAngle", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Content Outline</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground font-medium mb-2">Recommended Archetype</div>
              <Badge>{data.archetypeRecommendation}</Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground font-medium mb-2">Outline</div>
              <OutlineDisplay outline={data.outline} />
            </div>
            <div>
              <div className="text-sm text-muted-foreground font-medium mb-1">Estimated Word Count</div>
              <span className="text-sm">{data.estimatedWordCount?.toLocaleString()} words</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Hook Options</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.hookOptions?.map((hook, i) => (
                <div key={i} className="p-3 rounded-md bg-muted text-sm">
                  <span className="text-xs font-medium text-muted-foreground mr-2">Option {i + 1}</span>
                  {hook}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Research &amp; Context</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <EditableSection
              label="Citation Needs"
              value={data.citationNeeds}
              onSave={(v) => updateField("citationNeeds", v)}
            />
            <EditableSection
              label="Success Criteria"
              value={data.successCriteria}
              onSave={(v) => updateField("successCriteria", v)}
            />
            {data.kbContext && data.kbContext.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground font-medium mb-1">KB Context Used</div>
                <div className="flex flex-wrap gap-1">
                  {data.kbContext.map((ctx, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{ctx}</Badge>
                  ))}
                </div>
              </div>
            )}
            {data.internalLinkOpportunities && data.internalLinkOpportunities.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground font-medium mb-1">Internal Link Opportunities</div>
                <ul className="list-disc list-inside space-y-1">
                  {data.internalLinkOpportunities.map((link, i) => (
                    <li key={i} className="text-sm text-muted-foreground">{link}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {data.serpAnalysis && data.serpAnalysis.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">SERP Analysis</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.serpAnalysis.slice(0, 10).map((result) => (
                  <div key={result.position} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground w-5 flex-shrink-0">{result.position}.</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{result.url}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
