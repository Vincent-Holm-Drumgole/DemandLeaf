import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function StrategyDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await redirectToPreferredWorkspace(`/strategy/${id}`);
}
