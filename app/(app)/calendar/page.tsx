import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function CalendarRedirectPage() {
  await redirectToPreferredWorkspace("/calendar");
}
