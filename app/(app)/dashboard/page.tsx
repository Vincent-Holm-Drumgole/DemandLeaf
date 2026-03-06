import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function DashboardRedirectPage() {
  await redirectToPreferredWorkspace("/dashboard");
}
