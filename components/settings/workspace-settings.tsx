"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildWorkspaceApiUrl } from "@/lib/workspace-paths";

function getDeleteDestinationLabel(workspaceCount: number) {
  return workspaceCount > 1
    ? "You will be redirected to one of your remaining workspaces."
    : "You will be redirected to onboarding after deletion.";
}

export function WorkspaceSettings() {
  const { currentWorkspace, workspaces } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = currentWorkspace.role === "owner";
  const canDelete = confirmName.trim() === currentWorkspace.name;

  function resetDialog() {
    setConfirmName("");
    setError(null);
    setIsDeleting(false);
  }

  async function handleDeleteWorkspace() {
    if (!canDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        buildWorkspaceApiUrl("/api/workspaces/delete", currentWorkspace._id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmName }),
        }
      );
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          typeof data?.error === "string" && data.error.trim().length > 0
            ? data.error
            : "Failed to delete workspace."
        );
        setIsDeleting(false);
        return;
      }

      if (typeof data?.redirectTo === "string" && data.redirectTo.length > 0) {
        window.location.assign(data.redirectTo);
        return;
      }

      setError("Workspace was deleted, but redirect information was missing.");
      setIsDeleting(false);
    } catch (deleteError) {
      console.error("[workspace-settings] delete failed:", deleteError);
      setError("Failed to delete workspace.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Workspace Name</span>
          <span>{currentWorkspace.name}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Your Role</span>
          <span className="capitalize">{currentWorkspace.role}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Total Workspaces</span>
          <span>{workspaces.length}</span>
        </div>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h3 className="text-sm font-semibold text-red-900">Delete Workspace</h3>
        <p className="mt-2 text-sm text-red-800">
          Deleting a workspace permanently removes its content, briefs, integrations, and
          activity history. If this workspace has its own paid subscription, that billing
          will be canceled so you will not keep paying for this additional workspace.
        </p>
        <p className="mt-2 text-xs text-red-700">
          {getDeleteDestinationLabel(workspaces.length)}
        </p>
        {!isOwner ? (
          <p className="mt-4 text-sm text-red-800">
            Only workspace owners can delete a workspace.
          </p>
        ) : (
          <Button
            type="button"
            variant="destructive"
            className="mt-4"
            onClick={() => {
              resetDialog();
              setOpen(true);
            }}
          >
            Delete Workspace
          </Button>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            resetDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {currentWorkspace.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the workspace and cancels any subscription attached to
              it. Type the workspace name to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm-workspace-name">Workspace name</Label>
            <Input
              id="confirm-workspace-name"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
              placeholder={currentWorkspace.name}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Enter <span className="font-medium text-foreground">{currentWorkspace.name}</span> exactly.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteWorkspace}
              disabled={!canDelete || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
