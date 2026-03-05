import { NavSidebar } from "@/components/shell/nav-sidebar";
import { WorkspaceGuard } from "@/components/shell/workspace-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <NavSidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        <WorkspaceGuard>{children}</WorkspaceGuard>
      </main>
    </div>
  );
}
