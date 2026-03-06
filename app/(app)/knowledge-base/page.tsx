import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function KnowledgeBaseRedirectPage() {
  await redirectToPreferredWorkspace("/knowledge-base");
}
