import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function BlogRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await redirectToPreferredWorkspace(`/blog/${id}`);
}
