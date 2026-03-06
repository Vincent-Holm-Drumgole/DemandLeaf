import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPreferredWorkspaceRedirect } from "@/lib/workspace-server";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect(await getPreferredWorkspaceRedirect("/dashboard"));
  }
  redirect("/sign-in");
}
