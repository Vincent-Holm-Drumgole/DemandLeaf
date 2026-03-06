import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function BlogPerformanceRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ blogId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { blogId } = await params;
  const queryParams = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(queryParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const subpath =
    query.size > 0
      ? `/performance/${blogId}?${query.toString()}`
      : `/performance/${blogId}`;
  await redirectToPreferredWorkspace(subpath);
}
