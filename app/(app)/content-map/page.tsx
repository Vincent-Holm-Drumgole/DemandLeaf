import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function ContentMapRedirectPage() {
  await redirectToPreferredWorkspace("/content-map");
}
