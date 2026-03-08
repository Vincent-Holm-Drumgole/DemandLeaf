import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function ResearchRedirectPage() {
  await redirectToPreferredWorkspace("/research");
}
