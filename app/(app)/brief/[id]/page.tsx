import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function BriefRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await redirectToPreferredWorkspace(`/brief/${id}`);
}
