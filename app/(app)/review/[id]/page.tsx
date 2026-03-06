import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { parseConvexId } from "@/lib/convex-id";
import { getAuthedConvexClient } from "@/lib/convex";
import { buildWorkspacePath } from "@/lib/workspace-paths";
import { LegacyPreviewReviewPage } from "@/components/review/legacy-preview-review-page";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (id === "preview") {
    return <LegacyPreviewReviewPage />;
  }

  const blogId = parseConvexId(id, "blogs");
  if (!blogId) {
    notFound();
  }

  const { userId } = await auth();
  if (!userId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/review/${id}`)}`);
  }

  const convex = await getAuthedConvexClient();
  const blog = await convex.query(api.blogs.getById, { blogId });
  if (!blog) {
    notFound();
  }

  redirect(buildWorkspacePath(blog.workspaceId, `/review/${id}`));
}
