import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getPreferredWorkspaceRedirect } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

export default async function NotFound() {
  const { userId } = await auth();
  const dashboardHref = userId
    ? await getPreferredWorkspaceRedirect("/dashboard")
    : "/sign-in";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="mt-2 text-muted-foreground">Page not found</p>
      <Link href={dashboardHref} className="mt-4 text-sm text-primary underline">
        Go to Dashboard
      </Link>
    </div>
  );
}
