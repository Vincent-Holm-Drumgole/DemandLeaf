import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { SignInRedirect } from "@/components/auth/sign-in-redirect";
import { NavSidebar } from "@/components/shell/nav-sidebar";
import {
  WorkspaceProvider,
  type WorkspaceView,
} from "@/components/providers/workspace-provider";
import { getAuthedConvexClient } from "@/lib/convex";
import {
  getViewerWorkspaceById,
  listViewerWorkspaces,
} from "@/lib/workspace-server";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { userId } = await auth();
  if (!userId) {
    return <SignInRedirect />;
  }

  const { workspaceId } = await params;
  const convex = await getAuthedConvexClient();
  const [currentWorkspace, workspaces] = await Promise.all([
    getViewerWorkspaceById(convex, workspaceId),
    listViewerWorkspaces(convex),
  ]);

  if (workspaces.length === 0) {
    redirect("/onboarding");
  }

  if (!currentWorkspace) {
    notFound();
  }

  return (
    <WorkspaceProvider
      currentWorkspace={currentWorkspace as WorkspaceView}
      workspaces={workspaces as WorkspaceView[]}
    >
      <div className="flex min-h-screen">
        <NavSidebar />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </WorkspaceProvider>
  );
}
