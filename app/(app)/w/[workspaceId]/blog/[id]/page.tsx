"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import TurndownService from "turndown";
import { useBlogStore } from "@/store/blog-store";
import { TiptapEditor } from "@/components/blog-editor/tiptap-editor";
import { ExportBar } from "@/components/blog-editor/export-bar";
import { ScoreSidebar } from "@/components/scores/score-sidebar";
import { MetaPanel, type MetaFields } from "@/components/blog-editor/meta-panel";
import { AeoPanel } from "@/components/publishing/aeo-panel";
import { SchemaPanel } from "@/components/publishing/schema-panel";
import { InternalLinksPanel } from "@/components/publishing/internal-links-panel";
import { WpPublishPanel } from "@/components/publishing/wp-publish-panel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";

const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });

export default function BlogPage() {
  const params = useParams();
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const blogId = typeof params.id === "string" ? params.id : "";
  const { blog, isLoading, error, fetchBlog, isSaving, updateBlog } = useBlogStore();

  // Local editable state
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [meta, setMeta] = useState<MetaFields>({
    slug: "",
    metaTitle: "",
    metaDescription: "",
    focusKeyword: "",
  });
  const currentHtmlRef = useRef<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 5: Publishing state
  const [aeoScore, setAeoScore] = useState<number | null>(null);
  const [aeoChecks] = useState<import("@/types").AeoCheckResult[]>([]);
  const [schemaType, setSchemaType] = useState<import("@/types").SchemaType | null>(null);
  const [schemaJson, setSchemaJson] = useState<string | null>(null);
  const [wpConnections, setWpConnections] = useState<{ id: string; siteUrl: string; pluginDetected: string | null; status: string }[]>([]);
  const [authorPersonas, setAuthorPersonas] = useState<{ id: string; name: string; isDefault: boolean }[]>([]);

  useEffect(() => {
    if (blogId) fetchBlog(blogId);
  }, [blogId, fetchBlog]);

  // Fetch WP connections and personas for publishing panels
  useEffect(() => {
    fetch("/api/wp-connections")
      .then((r) => (r.ok ? r.json() : []))
      .then(setWpConnections)
      .catch(() => {});
    fetch("/api/author-personas")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAuthorPersonas)
      .catch(() => {});
  }, []);

  // Initialise local state once blog loads
  useEffect(() => {
    if (blog && !isDirty) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(blog.title);
      setStatus(blog.status);
      setMeta({
        slug: blog.slug ?? "",
        metaTitle: blog.metaTitle ?? "",
        metaDescription: blog.metaDescription ?? "",
        focusKeyword: blog.focusKeyword ?? "",
      });
      currentHtmlRef.current = blog.contentHtml ?? "";
      // Phase 5 fields
      if (blog.aeoScore !== undefined) setAeoScore(blog.aeoScore ?? null);
      if (blog.schemaType) setSchemaType(blog.schemaType as import("@/types").SchemaType);
      if (blog.schemaJson) setSchemaJson(blog.schemaJson);
    }
  }, [blog, isDirty]);

  const handleMetaChange = useCallback((partial: Partial<MetaFields>) => {
    setMeta((prev) => ({ ...prev, ...partial }));
    setIsDirty(true);
  }, []);

  const handleStatusChange = useCallback((val: string) => {
    setStatus(val);
    setIsDirty(true);
  }, []);

  const handleTitleChange = useCallback((val: string) => {
    setTitle(val);
    setIsDirty(true);
  }, []);

  const handleContentChange = useCallback((html: string) => {
    currentHtmlRef.current = html;
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!blog) return;
    const html = currentHtmlRef.current;
    const markdown = html ? td.turndown(html) : "";

    const ok = await updateBlog(blogId, {
      title,
      status,
      content: markdown,
      contentHtml: html,
      ...meta,
    });

    if (ok) {
      setIsDirty(false);
      setSavedOk(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedOk(false), 2000);
    } else {
      setSaveError(true);
      if (saveErrorTimerRef.current) clearTimeout(saveErrorTimerRef.current);
      saveErrorTimerRef.current = setTimeout(() => setSaveError(false), 4000);
    }
  }, [blog, blogId, title, status, meta, updateBlog]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (saveErrorTimerRef.current) clearTimeout(saveErrorTimerRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading blog...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!blog) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 text-muted-foreground"
            onClick={() => router.push(buildWorkspacePath(currentWorkspace._id, "/dashboard"))}
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>

          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-base font-semibold focus:outline-none truncate"
            placeholder="Blog title"
          />

          <div className="flex items-center gap-2 shrink-0">
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>

            {savedOk && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
            {saveError && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <XCircle className="h-3.5 w-3.5" />
                Save failed
              </span>
            )}

            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="h-8 gap-1.5"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>

            <ExportBar blogId={blog.id} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          {/* Editor */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <TiptapEditor
              initialHtml={blog.contentHtml ?? ""}
              onChange={handleContentChange}
            />
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <ScoreSidebar
              scores={blog.scores}
              wordCount={blog.wordCount}
            />
            <MetaPanel fields={meta} onChange={handleMetaChange} />
            <AeoPanel
              blogId={blogId}
              initialScore={aeoScore}
              initialChecks={aeoChecks}
              onOptimized={(score) => {
                setAeoScore(score);
                fetchBlog(blogId);
              }}
            />
            <SchemaPanel schemaType={schemaType} schemaJson={schemaJson} />
            <InternalLinksPanel blogId={blogId} suggestions={[]} />
            <WpPublishPanel
              blogId={blogId}
              wpPostUrl={blog.wpPostUrl}
              connections={wpConnections}
              personas={authorPersonas}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
