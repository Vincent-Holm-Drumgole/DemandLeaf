import { redirect } from "next/navigation";
import { getPreferredWorkspaceRedirect } from "@/lib/workspace-server";

export async function redirectToPreferredWorkspace(subpath: string) {
  redirect(await getPreferredWorkspaceRedirect(subpath));
}
