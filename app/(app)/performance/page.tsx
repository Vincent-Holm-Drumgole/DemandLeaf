import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function PerformanceRedirectPage() {
  await redirectToPreferredWorkspace("/performance");
}
