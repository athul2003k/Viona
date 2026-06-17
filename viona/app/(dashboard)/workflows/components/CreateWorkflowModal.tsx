"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createWorkflowWithInitialNode } from "../workflow-actions";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  userId: string;
  onCreated: () => void;
}

export function CreateWorkflowModal({
  open,
  onOpenChange,
  orgId,
  userId,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const result = await createWorkflowWithInitialNode({
        name,
        description: description.trim() || undefined,
        orgId,
      });

      if (result && 'error' in result) {
        toast.error(result.error as string);
        return;
      }

      setName("");
      setDescription("");
      onCreated();
      onOpenChange(false);
      toast.success("Workflow created successfully");
    } catch (error) {
      console.error("Failed to create workflow:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create workflow");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="workflow-name">Name *</Label>
            <Input
              id="workflow-name"
              placeholder="Workflow name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="workflow-desc">Description</Label>
            <Textarea
              id="workflow-desc"
              placeholder="What does this workflow do? (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isSaving}>
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
