import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function StrategyRedirectPage() {
  await redirectToPreferredWorkspace("/strategy");
}
