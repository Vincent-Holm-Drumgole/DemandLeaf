"use client";

import { useState, type KeyboardEvent } from "react";
import { Loader2, AlertTriangle, ChevronDown, ChevronRight, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ImportPayload {
  strategyName: string;
  businessOutcomes: string;
  targetAudience: string;
  seedKeywords: string[];
  masterContext: string;
  competitors: { domain: string; trackedKeywords: string[] }[];
  thoughtLeadershipPositions: string[];
  neverSayTerms: string[];
  knowledgeBaseEntries: {
    title: string;
    content: string;
    entryType: string;
    tags: string[];
  }[];
  pillars: {
    name: string;
    keywords: {
      keyword: string;
      archetype: string;
      contentTrack: string;
    }[];
  }[];
  publishSchedule: {
    postsPerWeek: number;
    startDate: string;
  };
}

type Phase = "input" | "review" | "importing";

interface Props {
  onComplete: (strategyId: string) => void;
}

export function ConversationalStrategy({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("input");
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ImportPayload | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleParse = async () => {
    if (!input.trim()) return;
    setIsParsing(true);
    setError(null);

    try {
      const res = await fetch("/api/strategy/parse-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to parse strategy");

      const payload = data.parsed as ImportPayload;
      // Ensure arrays exist
      payload.seedKeywords = payload.seedKeywords ?? [];
      payload.competitors = payload.competitors ?? [];
      payload.thoughtLeadershipPositions = payload.thoughtLeadershipPositions ?? [];
      payload.neverSayTerms = payload.neverSayTerms ?? [];
      payload.knowledgeBaseEntries = payload.knowledgeBaseEntries ?? [];
      payload.pillars = payload.pillars ?? [];
      payload.publishSchedule = payload.publishSchedule ?? { postsPerWeek: 2, startDate: getNextMonday() };

      setParsed(payload);
      setMissingFields(data.missingFields ?? []);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setIsImporting(true);
    setError(null);
    setPhase("importing");

    try {
      const res = await fetch("/api/strategy/conversational-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      onComplete(data.strategyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setPhase("review");
    } finally {
      setIsImporting(false);
    }
  };

  if (phase === "input") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Describe your content strategy in plain language. Include your goals, target audience,
          seed keywords, content pillars, competitor URLs, and any brand voice guidelines.
        </p>
        <Textarea
          placeholder={"Example: We're a B2B SaaS company that helps marketing teams...\n\nOur goals are to...\n\nTarget audience: ...\n\nSeed keywords: ...\n\nContent pillars:\n1. ...\n2. ...\n\nCompetitors: ...\n\nWe never say: ..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={14}
          className="font-mono text-sm"
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{input.length.toLocaleString()} / 15,000 characters</span>
        </div>
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={handleParse} disabled={isParsing || !input.trim()}>
            {isParsing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Parsing with AI...
              </>
            ) : (
              "Parse Strategy"
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "importing") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Importing strategy...</p>
        <p className="text-xs text-muted-foreground">
          Creating keywords, clusters, calendar, and knowledge base entries.
        </p>
      </div>
    );
  }

  // Review phase
  return (
    <div className="space-y-4">
      {missingFields.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 text-sm">
          <p className="font-medium text-yellow-800 dark:text-yellow-200 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> Missing fields
          </p>
          <p className="text-yellow-700 dark:text-yellow-300 mt-1">
            The following could not be determined: {missingFields.join(", ")}. Please fill them in below.
          </p>
        </div>
      )}

      {parsed && (
        <ReviewForm
          payload={parsed}
          onChange={setParsed}
          error={error}
          isImporting={isImporting}
          onImport={handleImport}
          onBack={() => setPhase("input")}
        />
      )}
    </div>
  );
}

function ReviewForm({
  payload,
  onChange,
  error,
  isImporting,
  onImport,
  onBack,
}: {
  payload: ImportPayload;
  onChange: (p: ImportPayload) => void;
  error: string | null;
  isImporting: boolean;
  onImport: () => void;
  onBack: () => void;
}) {
  const update = <K extends keyof ImportPayload>(key: K, value: ImportPayload[K]) => {
    onChange({ ...payload, [key]: value });
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {/* Strategy basics */}
      <div className="space-y-2">
        <Label>Strategy Name</Label>
        <Input
          value={payload.strategyName ?? ""}
          onChange={(e) => update("strategyName", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Business Outcomes</Label>
        <Textarea
          value={payload.businessOutcomes ?? ""}
          onChange={(e) => update("businessOutcomes", e.target.value)}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label>Target Audience</Label>
        <Input
          value={payload.targetAudience ?? ""}
          onChange={(e) => update("targetAudience", e.target.value)}
        />
      </div>

      {/* Seed keywords */}
      <TagSection
        label="Seed Keywords"
        tags={payload.seedKeywords}
        onChange={(tags) => update("seedKeywords", tags)}
      />

      {/* Competitors */}
      <CollapsibleSection
        label="Competitors"
        count={payload.competitors?.length ?? 0}
      >
        {payload.competitors?.map((comp, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <Input
              value={comp.domain}
              onChange={(e) => {
                const updated = [...payload.competitors];
                updated[i] = { ...comp, domain: e.target.value };
                update("competitors", updated);
              }}
              className="text-sm"
              placeholder="example.com"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update("competitors", payload.competitors.filter((_, j) => j !== i))}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => update("competitors", [...(payload.competitors ?? []), { domain: "", trackedKeywords: [] }])}
        >
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </CollapsibleSection>

      {/* Pillars */}
      <CollapsibleSection
        label="Content Pillars"
        count={payload.pillars?.length ?? 0}
        defaultOpen
      >
        {payload.pillars?.map((pillar, pi) => (
          <Card key={pi} className="mb-2">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center gap-2">
                <Input
                  value={pillar.name}
                  onChange={(e) => {
                    const updated = [...payload.pillars];
                    updated[pi] = { ...pillar, name: e.target.value };
                    update("pillars", updated);
                  }}
                  className="text-sm font-medium"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update("pillars", payload.pillars.filter((_, j) => j !== pi))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="py-1 px-3">
              <div className="flex flex-wrap gap-1">
                {pillar.keywords.map((kw, ki) => (
                  <Badge key={ki} variant="secondary" className="text-xs gap-1">
                    {kw.keyword}
                    <button
                      onClick={() => {
                        const updated = [...payload.pillars];
                        updated[pi] = {
                          ...pillar,
                          keywords: pillar.keywords.filter((_, j) => j !== ki),
                        };
                        update("pillars", updated);
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </CollapsibleSection>

      {/* Thought leadership */}
      <CollapsibleSection
        label="Thought Leadership Positions"
        count={payload.thoughtLeadershipPositions?.length ?? 0}
      >
        {payload.thoughtLeadershipPositions?.map((pos, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <Input
              value={pos}
              onChange={(e) => {
                const updated = [...payload.thoughtLeadershipPositions];
                updated[i] = e.target.value;
                update("thoughtLeadershipPositions", updated);
              }}
              className="text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update("thoughtLeadershipPositions", payload.thoughtLeadershipPositions.filter((_, j) => j !== i))}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => update("thoughtLeadershipPositions", [...(payload.thoughtLeadershipPositions ?? []), ""])}
        >
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </CollapsibleSection>

      {/* Never-say terms */}
      <TagSection
        label="Never-Say Terms"
        tags={payload.neverSayTerms}
        onChange={(tags) => update("neverSayTerms", tags)}
      />

      {/* KB entries */}
      <CollapsibleSection
        label="Knowledge Base Entries"
        count={payload.knowledgeBaseEntries?.length ?? 0}
      >
        {payload.knowledgeBaseEntries?.map((entry, i) => (
          <Card key={i} className="mb-2">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm flex-1">{entry.title}</CardTitle>
                <Badge variant="outline" className="text-xs">{entry.entryType}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update("knowledgeBaseEntries", payload.knowledgeBaseEntries.filter((_, j) => j !== i))}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="py-1 px-3">
              <p className="text-xs text-muted-foreground line-clamp-2">{entry.content}</p>
            </CardContent>
          </Card>
        ))}
      </CollapsibleSection>

      {/* Publishing schedule */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Posts per Week</Label>
          <Input
            type="number"
            min={1}
            max={7}
            value={payload.publishSchedule?.postsPerWeek ?? 2}
            onChange={(e) => update("publishSchedule", {
              ...payload.publishSchedule,
              postsPerWeek: Math.max(1, Math.min(7, parseInt(e.target.value) || 2)),
            })}
          />
        </div>
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={payload.publishSchedule?.startDate ?? getNextMonday()}
            onChange={(e) => update("publishSchedule", {
              ...payload.publishSchedule,
              startDate: e.target.value,
            })}
          />
        </div>
      </div>

      {/* Master context */}
      <CollapsibleSection label="Master Context" count={payload.masterContext ? 1 : 0}>
        <Textarea
          value={payload.masterContext ?? ""}
          onChange={(e) => update("masterContext", e.target.value)}
          rows={4}
          className="text-sm"
        />
      </CollapsibleSection>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      <div className="flex justify-between pt-2 sticky bottom-0 bg-background pb-1">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onImport}
          disabled={isImporting || !payload.strategyName || !payload.seedKeywords?.length}
        >
          {isImporting ? (
            <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Importing...</>
          ) : (
            "Import Strategy"
          )}
        </Button>
      </div>
    </div>
  );
}

function TagSection({
  label,
  tags,
  onChange,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1 mb-1">
        {tags.map((tag, i) => (
          <Badge key={i} variant="secondary" className="text-xs gap-1">
            {tag}
            <button onClick={() => onChange(tags.filter((_, j) => j !== i))} className="ml-1 hover:text-destructive">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add ${label.toLowerCase()}...`}
          className="text-sm"
        />
        <Button variant="outline" size="sm" onClick={addTag} disabled={!inputValue.trim()}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function CollapsibleSection({
  label,
  count,
  defaultOpen = false,
  children,
}: {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-md">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium hover:bg-muted/50"
      >
        <span>
          {label} {count > 0 && <span className="text-muted-foreground">({count})</span>}
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}
