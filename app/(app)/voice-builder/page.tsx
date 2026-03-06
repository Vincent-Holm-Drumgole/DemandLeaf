import { redirectToPreferredWorkspace } from "@/lib/workspace-redirect";

export default async function VoiceBuilderRedirectPage() {
  await redirectToPreferredWorkspace("/voice-builder");
}
