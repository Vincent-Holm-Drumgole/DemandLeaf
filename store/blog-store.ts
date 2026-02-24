import { create } from "zustand";

interface BlogFeedback {
  id: string;
  paragraphIndex: number;
  feedback: "positive" | "negative";
  comment: string | null;
  createdAt: string;
}

interface BlogData {
  id: string;
  title: string;
  slug: string | null;
  content: string;
  contentHtml: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  archetype: string;
  wordCount: number | null;
  status: string;
  scores: {
    seoScore: number | null;
    qualityScore: number | null;
    detectionRisk: string | null;
    detectionRiskScore: number | null;
    burstinessScore: number | null;
    readabilityScore: number | null;
  };
  createdAt: string;
  feedback: BlogFeedback[];
}

interface BlogState {
  blog: BlogData | null;
  isLoading: boolean;
  error: string | null;
  feedbackSubmitting: boolean;
  feedbackError: string | null;
  isSaving: boolean;
  saveError: string | null;

  fetchBlog: (id: string) => Promise<void>;
  submitFeedback: (
    blogId: string,
    paragraphIndex: number,
    feedback: "positive" | "negative",
    comment?: string
  ) => Promise<void>;
  exportBlog: (
    blogId: string,
    format: "html" | "markdown" | "clipboard"
  ) => Promise<string | null>;
  updateBlog: (
    id: string,
    fields: Partial<BlogData> & { contentHtml?: string }
  ) => Promise<boolean>;
}

export const useBlogStore = create<BlogState>((set) => ({
  blog: null,
  isLoading: false,
  error: null,
  feedbackSubmitting: false,
  feedbackError: null,
  isSaving: false,
  saveError: null,

  fetchBlog: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/blog/${id}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load blog");
      }
      const blog: BlogData = await response.json();
      set({ blog, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load blog",
        isLoading: false,
      });
    }
  },

  submitFeedback: async (blogId, paragraphIndex, feedback, comment) => {
    set({ feedbackSubmitting: true, feedbackError: null });
    try {
      const response = await fetch(`/api/blog/${blogId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paragraphIndex, feedback, comment }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      const created = await response.json();
      set((state) => {
        if (!state.blog) return state;
        return {
          blog: {
            ...state.blog,
            feedback: [
              {
                id: created.id,
                paragraphIndex: created.paragraphIndex,
                feedback: created.feedback,
                comment: created.comment,
                createdAt: created.createdAt,
              },
              ...state.blog.feedback,
            ],
          },
          feedbackSubmitting: false,
        };
      });
    } catch {
      set({ feedbackSubmitting: false, feedbackError: "Failed to submit feedback" });
    }
  },

  exportBlog: async (blogId, format) => {
    try {
      const response = await fetch(`/api/export/${blogId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });

      if (!response.ok) return null;

      if (format === "clipboard") {
        const data = await response.json();
        try {
          await navigator.clipboard.writeText(data.content);
          return "copied";
        } catch {
          console.error("Clipboard write failed");
          return null;
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "html" ? "blog.html" : "blog.md";
      a.click();
      URL.revokeObjectURL(url);
      return "downloaded";
    } catch {
      return null;
    }
  },

  updateBlog: async (id, fields) => {
    set({ isSaving: true, saveError: null });
    try {
      const response = await fetch(`/api/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to save");
      }
      set((state) => ({
        blog: state.blog ? { ...state.blog, ...fields } : state.blog,
        isSaving: false,
      }));
      return true;
    } catch (err) {
      set({
        isSaving: false,
        saveError: err instanceof Error ? err.message : "Failed to save",
      });
      return false;
    }
  },
}));
