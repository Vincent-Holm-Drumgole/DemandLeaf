import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function AgentsRedirectPage() {
  await redirectToPreferredWorkspace("/agents");
}
