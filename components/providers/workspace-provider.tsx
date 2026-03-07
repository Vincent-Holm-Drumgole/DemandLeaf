"use client";

import { createContext, useContext, useLayoutEffect } from "react";
import {
  installWorkspaceFetch,
  setActiveWorkspaceId,
} from "@/lib/api-fetch";
import { createActiveWorkspaceCookie } from "@/lib/workspace-cookie";

export interface WorkspaceView {
  _id: string;
  name: string;
  role: "owner" | "admin" | "member";
  plan?: string;
  trialEndsAt?: number;
  url?: string;
  industry?: string;
  audienceDescription?: string;
  masterContext?: string;
}

interface WorkspaceContextValue {
  currentWorkspace: WorkspaceView;
  workspaces: WorkspaceView[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  currentWorkspace,
  workspaces,
  children,
}: React.PropsWithChildren<WorkspaceContextValue>) {
  useLayoutEffect(() => {
    installWorkspaceFetch();
    setActiveWorkspaceId(currentWorkspace._id);

    const cookie = createActiveWorkspaceCookie(currentWorkspace._id);
    document.cookie = `${cookie.name}=${cookie.value}; path=${cookie.path}; max-age=${cookie.maxAge}; samesite=${cookie.sameSite}`;
  }, [currentWorkspace._id]);

  return (
    <WorkspaceContext.Provider value={{ currentWorkspace, workspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
