"use client";

import type { KeyboardEvent } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Pen,
  Target,
  CalendarDays,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useWriteBlogStore } from "@/store/write-blog-store";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { buildWorkspacePath } from "@/lib/workspace-paths";
import { ARCHETYPE_LIST } from "@/lib/constants/archetypes";
import { StrategyKeywordPicker } from "./strategy-keyword-picker";
import type { PipelineStepStatus } from "@/types";

const STEP_DISPLAY_NAMES = [
  "Researching your topic",
  "Writing in your voice",
  "Checking voice consistency",
  "Optimizing for search",
  "Polishing content",
  "Generating metadata",
  "Running quality checks",
];

function StepIcon({ status }: { status: PipelineStepStatus }) {
  if (status === "complete") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M11.5 3.5L5.5 10.5L2.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (status === "running") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white">
        <span className="text-[10px] font-bold">!</span>
      </div>
    );
  }
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted">
      <div className="h-1.5 w-1.5 rounded-full bg-muted" />
    </div>
  );
}

export function WriteBlogDialog() {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const store = useWriteBlogStore();

  // Auto-redirect on completion
  useEffect(() => {
    if (store.step === "complete" && store.resultBlogId && currentWorkspace) {
      const timer = setTimeout(() => {
        const path = buildWorkspacePath(currentWorkspace._id, `/blog/${store.resultBlogId}`);
        store.reset();
        router.push(path);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [store.step, store.resultBlogId, currentWorkspace, router, store]);

  const canGenerate =
    store.keyword.trim().length >= 2 &&
    !store.isGenerating;

  return (
    <Dialog open={store.isOpen} onOpenChange={(open) => !open && store.close()}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => store.isGenerating && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {store.step !== "choose" && store.step !== "complete" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => store.isGenerating ? null : useWriteBlogStore.setState({ step: store.step === "generating" ? "configure" : "choose" })}
                disabled={store.isGenerating}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Sparkles className="h-4 w-4" />
            {store.step === "choose" && "Write a Blog"}
            {store.step === "configure" && (
              store.mode === "quick" ? "Quick Write" :
              store.mode === "strategy" ? "From Strategy" : "From Calendar"
            )}
            {store.step === "generating" && "Generating..."}
            {store.step === "complete" && "Done!"}
          </DialogTitle>
        </DialogHeader>

        {/* Step: Choose mode */}
        {store.step === "choose" && (
          <div className="space-y-2">
            <ModeCard
              icon={<Pen className="h-5 w-5" />}
              title="Quick Write"
              description="Enter a keyword and pick a format"
              onClick={() => store.setMode("quick")}
            />
            <ModeCard
              icon={<Target className="h-5 w-5" />}
              title="From Strategy"
              description="Choose from your strategy keywords"
              onClick={() => {
                store.setMode("strategy");
              }}
            />
            <ModeCard
              icon={<CalendarDays className="h-5 w-5" />}
              title="From Calendar"
              description="Pick from upcoming scheduled posts"
              onClick={() => {
                store.setMode("calendar");
                store.loadUpcomingCalendar();
              }}
            />
          </div>
        )}

        {/* Step: Configure - Quick */}
        {store.step === "configure" && store.mode === "quick" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Focus Keyword</label>
              <Input
                value={store.keyword}
                onChange={(e) => store.setKeyword(e.target.value)}
                placeholder="e.g. content marketing strategy"
                className="h-10"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Blog Format</label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {ARCHETYPE_LIST.map((option) => (
                  <Card
                    key={option.id}
                    className={`cursor-pointer transition-colors ${
                      store.archetype === option.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/30"
                    }`}
                    role="radio"
                    aria-checked={store.archetype === option.id}
                    tabIndex={0}
                    onClick={() => store.setArchetype(option.id)}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        store.setArchetype(option.id);
                      }
                    }}
                  >
                    <CardContent className="flex items-start gap-2.5 py-2 px-3">
                      <div
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                          store.archetype === option.id
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        }`}
                      />
                      <div>
                        <p className="text-xs font-medium">{option.label}</p>
                        <p className="text-[11px] text-muted-foreground">{option.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!canGenerate}
              onClick={() => store.startGeneration()}
            >
              Generate Blog Post
            </Button>
          </div>
        )}

        {/* Step: Configure - Strategy */}
        {store.step === "configure" && store.mode === "strategy" && (
          <div className="space-y-4">
            <StrategyKeywordPicker />
            {store.selectedKeywordId && (
              <Button
                className="w-full"
                disabled={!canGenerate}
                onClick={() => store.startGeneration()}
              >
                Generate Blog Post
              </Button>
            )}
          </div>
        )}

        {/* Step: Configure - Calendar */}
        {store.step === "configure" && store.mode === "calendar" && (
          <div className="space-y-4">
            {store.loadingCalendar ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : store.calendarItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No upcoming calendar items found
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-md border">
                {store.calendarItems.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => store.selectCalendarItem(item._id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-accent transition-colors ${
                      store.selectedCalendarItemId === item._id
                        ? "bg-primary/5 border-l-2 border-primary"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.keyword}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(item.scheduledDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0 ml-2">
                      {item.archetype?.replace(/_/g, " ") ?? "how to"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
            {store.selectedCalendarItemId && (
              <Button
                className="w-full"
                disabled={!canGenerate}
                onClick={() => store.startGeneration()}
              >
                Generate Blog Post
              </Button>
            )}
          </div>
        )}

        {/* Step: Generating */}
        {store.step === "generating" && (
          <div className="py-2">
            <p className="text-center text-sm text-muted-foreground mb-4">
              Writing about &ldquo;{store.keyword}&rdquo;
            </p>
            <div className="space-y-1">
              {STEP_DISPLAY_NAMES.map((name, i) => {
                const step = store.generationSteps.find((s) => s.name === name);
                const status: PipelineStepStatus = step?.status ?? "pending";
                const duration = step?.durationMs;

                return (
                  <div key={i} className="flex items-center gap-2.5 py-1.5">
                    <StepIcon status={status} />
                    <span
                      className={`text-xs flex-1 ${
                        status === "running"
                          ? "text-foreground font-medium"
                          : status === "complete"
                            ? "text-muted-foreground"
                            : "text-muted-foreground/60"
                      }`}
                    >
                      {name}
                    </span>
                    {status === "complete" && duration && (
                      <span className="text-[10px] text-muted-foreground">
                        {(duration / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {store.generationError && (
              <div className="mt-4 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
                {store.generationError}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full text-xs"
                  onClick={() => useWriteBlogStore.setState({ step: "configure", generationError: null })}
                >
                  Try Again
                </Button>
              </div>
            )}

            {!store.generationError && (
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                This typically takes 30-90 seconds
              </p>
            )}
          </div>
        )}

        {/* Step: Complete */}
        {store.step === "complete" && (
          <div className="flex flex-col items-center py-6 gap-3">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium">Blog generated successfully!</p>
            <p className="text-xs text-muted-foreground">Redirecting to editor...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModeCard({
  icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
