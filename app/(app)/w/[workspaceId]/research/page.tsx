"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";
import { apiFetch } from "@/lib/api-fetch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CompetitorArticle, ResearchBrief, ResearchSource } from "@/types";

interface DashboardState {
  sources: ResearchSource[];
  briefs: ResearchBrief[];
  competitorArticles: CompetitorArticle[];
}

export default function ResearchPage() {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [data, setData] = useState<DashboardState>({ sources: [], briefs: [], competitorArticles: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceForm, setSourceForm] = useState({
    label: "",
    type: "rss" as "rss" | "url",
    url: "",
    keywords: "",
  });
  const [articleForm, setArticleForm] = useState({
    domain: "",
    url: "",
    title: "",
    summary: "",
    angle: "",
    keywords: "",
  });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/research", {
        headers: { "x-workspace-id": currentWorkspace._id },
      });
      if (!res.ok) {
        throw new Error("Failed to load research dashboard");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load research dashboard");
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace._id]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function createSource() {
    const res = await apiFetch("/api/research/sources", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": currentWorkspace._id,
      },
      body: JSON.stringify({
        ...sourceForm,
        keywords: sourceForm.keywords.split(",").map((value) => value.trim()).filter(Boolean),
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      setError(payload?.error ?? "Failed to create source");
      return;
    }
    setSourceForm({ label: "", type: "rss", url: "", keywords: "" });
    void loadDashboard();
  }

  async function updateBrief(briefId: string, patch: Record<string, unknown>) {
    const res = await apiFetch(`/api/research/briefs/${briefId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": currentWorkspace._id,
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setError("Failed to update research brief");
      return;
    }
    void loadDashboard();
  }

  async function createCompetitorArticle() {
    const res = await apiFetch("/api/research/competitor-articles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": currentWorkspace._id,
      },
      body: JSON.stringify({
        ...articleForm,
        keywords: articleForm.keywords.split(",").map((value) => value.trim()).filter(Boolean),
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      setError(payload?.error ?? "Failed to save competitor article");
      return;
    }
    setArticleForm({ domain: "", url: "", title: "", summary: "", angle: "", keywords: "" });
    void loadDashboard();
  }

  async function generateDraft(briefId: string) {
    const res = await apiFetch(`/api/research/briefs/${briefId}/draft`, {
      method: "POST",
      headers: {
        "x-workspace-id": currentWorkspace._id,
      },
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      setError(payload?.error ?? "Failed to generate research draft");
      return;
    }
    const payload = await res.json();
    router.push(buildWorkspacePath(currentWorkspace._id, `/review/${payload.blogId}`));
  }

  async function toggleSourceStatus(sourceId: string, currentStatus: string) {
    const res = await apiFetch(`/api/research/sources/${sourceId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-workspace-id": currentWorkspace._id,
      },
      body: JSON.stringify({
        status: currentStatus === "active" ? "paused" : "active",
      }),
    });
    if (!res.ok) {
      setError("Failed to update source status");
      return;
    }
    void loadDashboard();
  }

  const dailyBriefs = data.briefs.filter((brief) => brief.kind === "daily_brief");
  const trendReports = data.briefs.filter((brief) => brief.kind === "trend_report");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-xl font-semibold">Research</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor source feeds, review research briefs, track competitor angles, and generate
            manual-review research drafts.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading research dashboard…</p>
        ) : (
          <Tabs defaultValue="sources">
            <TabsList>
              <TabsTrigger value="sources">Sources</TabsTrigger>
              <TabsTrigger value="briefs">Briefs</TabsTrigger>
              <TabsTrigger value="competitive">Competitive Intel</TabsTrigger>
              <TabsTrigger value="trends">Trend Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="sources" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Source</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label>Label</Label>
                    <Input
                      value={sourceForm.label}
                      onChange={(event) => setSourceForm((current) => ({ ...current, label: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={sourceForm.type}
                      onValueChange={(value) =>
                        setSourceForm((current) => ({ ...current, type: value as "rss" | "url" }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rss">RSS feed</SelectItem>
                        <SelectItem value="url">Direct URL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>URL</Label>
                    <Input
                      value={sourceForm.url}
                      onChange={(event) => setSourceForm((current) => ({ ...current, url: event.target.value }))}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={createSource}>Add Source</Button>
                  </div>
                  <div className="space-y-1.5 md:col-span-4">
                    <Label>Keywords</Label>
                    <Input
                      value={sourceForm.keywords}
                      placeholder="salesforce, hubspot, attribution"
                      onChange={(event) => setSourceForm((current) => ({ ...current, keywords: event.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-3 md:grid-cols-2">
                {data.sources.map((source) => (
                  <Card key={source.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle className="text-sm">{source.label}</CardTitle>
                          <p className="text-xs text-muted-foreground">{source.url}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleSourceStatus(source.id, source.status)}
                        >
                          {source.status === "active" ? "Pause" : "Resume"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground space-y-1">
                      <p>Status: {source.status}</p>
                      <p>Keywords: {source.keywords.join(", ") || "—"}</p>
                      <p>Last checked: {source.lastCheckedAt ? new Date(source.lastCheckedAt).toLocaleString() : "Never"}</p>
                      {source.errorMessage && <p className="text-destructive">{source.errorMessage}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="briefs" className="space-y-4 mt-4">
              {dailyBriefs.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-sm text-muted-foreground">
                    No research briefs yet. Add sources and wait for the daily monitor, or create one manually through source ingestion.
                  </CardContent>
                </Card>
              ) : (
                dailyBriefs.map((brief) => (
                  <Card key={brief.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{brief.title}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Relevance {brief.relevanceScore} • {brief.status.replace(/_/g, " ")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => updateBrief(brief.id, { status: "approved" })}>
                            Approve
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => updateBrief(brief.id, { status: "archived" })}>
                            Archive
                          </Button>
                          <Button size="sm" onClick={() => generateDraft(brief.id)}>
                            Generate Draft
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>{brief.summary}</p>
                      <p className="text-muted-foreground">Why it matters: {brief.whyItMatters}</p>
                      <p className="text-muted-foreground">Suggested angle: {brief.suggestedAngle}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {brief.sourceUrls.map((sourceUrl, index) => (
                          <a key={sourceUrl} href={sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            {brief.sourceNames[index] ?? sourceUrl}
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="competitive" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add Competitor Article</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input placeholder="Domain" value={articleForm.domain} onChange={(event) => setArticleForm((current) => ({ ...current, domain: event.target.value }))} />
                    <Input placeholder="Article URL" value={articleForm.url} onChange={(event) => setArticleForm((current) => ({ ...current, url: event.target.value }))} />
                  </div>
                  <Input placeholder="Title" value={articleForm.title} onChange={(event) => setArticleForm((current) => ({ ...current, title: event.target.value }))} />
                  <Textarea placeholder="Summary" value={articleForm.summary} onChange={(event) => setArticleForm((current) => ({ ...current, summary: event.target.value }))} rows={3} />
                  <Textarea placeholder="Angle competitors are taking" value={articleForm.angle} onChange={(event) => setArticleForm((current) => ({ ...current, angle: event.target.value }))} rows={2} />
                  <Input placeholder="Keywords" value={articleForm.keywords} onChange={(event) => setArticleForm((current) => ({ ...current, keywords: event.target.value }))} />
                  <Button onClick={createCompetitorArticle}>Save Competitor Article</Button>
                </CardContent>
              </Card>

              <div className="grid gap-3 md:grid-cols-2">
                {data.competitorArticles.map((article) => (
                  <Card key={article.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{article.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p className="text-muted-foreground">{article.domain}</p>
                      <p>{article.summary}</p>
                      <p className="text-xs text-muted-foreground">Angle: {article.angle}</p>
                      <a href={article.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                        Open source
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4 mt-4">
              {trendReports.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-sm text-muted-foreground">
                    No trend reports yet. The daily monitor will aggregate recent relevant briefs into a monthly trend report.
                  </CardContent>
                </Card>
              ) : (
                trendReports.map((brief) => (
                  <Card key={brief.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{brief.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>{brief.summary}</p>
                      <p className="text-muted-foreground">{brief.whyItMatters}</p>
                      <Button size="sm" onClick={() => generateDraft(brief.id)}>
                        Generate Trend Draft
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
