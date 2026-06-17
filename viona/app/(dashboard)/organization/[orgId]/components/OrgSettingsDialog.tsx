"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Settings, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrgStore } from "@/hooks/useOrgStore";
import { updateOrganization, deleteOrganization, getUserOrganizations } from "../../actions";

interface OrgSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  onDeleted: () => void;
}

export function OrgSettingsDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
  onDeleted,
}: OrgSettingsDialogProps) {
  const { toast } = useToast();
  const { setOrgs } = useOrgStore();

  // General settings state
  const [newName, setNewName] = useState(orgName);
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete state
  const [isForceDelete, setIsForceDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset state when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setNewName(orgName);
      setIsForceDelete(false);
      setDeleteConfirmation("");
      setDeleteError(null);
    }
    onOpenChange(isOpen);
  };

  // Update organization name
  const handleUpdateName = async () => {
    if (!newName.trim() || newName === orgName || isUpdating) return;

    setIsUpdating(true);
    try {
      await updateOrganization(orgId, newName.trim());
      toast({
        title: "Organization Updated",
        description: "Organization name has been updated successfully.",
      });

      // Refresh organizations in store
      const updatedOrgs = await getUserOrganizations();
      setOrgs(updatedOrgs);

      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update organization",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete organization
  const handleDelete = async () => {
    if (deleteConfirmation !== orgName || isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteOrganization(orgId, isForceDelete);
      toast({
        title: "Organization Deleted",
        description: isForceDelete
          ? "Organization and all its data have been permanently deleted."
          : "Organization has been deleted.",
      });

      // Refresh organizations in store
      const updatedOrgs = await getUserOrganizations();
      setOrgs(updatedOrgs);

      onOpenChange(false);
      onDeleted();
    } catch (err: any) {
      const errorMessage = err.message || "Failed to delete organization";

      // Check if it requires force delete
      if (
        errorMessage.toLowerCase().includes("cannot delete") ||
        errorMessage.toLowerCase().includes("has existing") ||
        errorMessage.toLowerCase().includes("contains")
      ) {
        setDeleteError(
          `${errorMessage} Enable "Force delete all data" to proceed.`
        );
      } else {
        setDeleteError(errorMessage);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = deleteConfirmation === orgName;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Organization Settings
          </DialogTitle>
          <DialogDescription>
            Manage settings for "{orgName}"
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="danger" className="text-destructive">
              Danger Zone
            </TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={isUpdating}
                placeholder="Enter organization name"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleUpdateName}
                disabled={!newName.trim() || newName === orgName || isUpdating}
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </TabsContent>

          {/* Danger Zone Tab */}
          <TabsContent value="danger" className="space-y-4 mt-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Deleting an organization is permanent and cannot be undone.
              </AlertDescription>
            </Alert>

            {/* Delete Error */}
            {deleteError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{deleteError}</AlertDescription>
              </Alert>
            )}

            {/* Force Delete Checkbox */}
            <div className="flex items-start space-x-3">
              <Checkbox
                id="force-delete"
                checked={isForceDelete}
                onCheckedChange={(checked: boolean) => setIsForceDelete(checked)}
                disabled={isDeleting}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="force-delete"
                  className="text-sm font-medium leading-none"
                >
                  Force delete all data
                </Label>
                <p className="text-xs text-muted-foreground">
                  Delete organization and permanently remove all products, orders,
                  warehouses, and members
                </p>
              </div>
            </div>

            {/* Force Delete Warning */}
            {isForceDelete && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="font-medium">⚠️ PERMANENT DATA LOSS WARNING</p>
                  <p className="text-sm">This will permanently delete:</p>
                  <ul className="text-sm list-disc ml-4 space-y-1">
                    <li>All products and inventory</li>
                    <li>All orders and order history</li>
                    <li>All warehouses and locations</li>
                    <li>All team members and invitations</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Confirmation Input */}
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono font-bold">{orgName}</span> to
                confirm deletion
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Enter organization name"
                disabled={isDeleting}
                className="font-mono"
              />
            </div>

            {/* Delete Button */}
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!canDelete || isDeleting}
              className="w-full gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting
                ? "Deleting..."
                : isForceDelete
                ? "Force Delete Organization"
                : "Delete Organization"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
