"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { WorkflowActionsMenu } from "./WorkflowActionsMenu";
import { toggleWorkflowStatus } from "../workflow-actions";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

import { WorkflowListItem } from "../types";

interface WorkflowCardProps {
  workflow: WorkflowListItem;
  onUpdate: () => void;
  onDelete: () => void;
  onStatusToggle?: () => void;
  canManage: boolean;
}

export function WorkflowCard({ workflow, onUpdate, onDelete, onStatusToggle, canManage }: WorkflowCardProps) {
  const [optimisticActive, setOptimisticActive] = useState(workflow.status === "active");

  const handleToggle = async (checked: boolean) => {
    setOptimisticActive(checked);
    try {
      const result = await toggleWorkflowStatus(workflow.id);
      if (result && result.error) {
        setOptimisticActive(!checked);
        toast.error(result.error);
      }
    } catch (err) {
      setOptimisticActive(!checked);
      toast.error("Failed to update workflow status");
    }
  };

  return (
    <Card className="p-5 hover:bg-muted/50 transition relative flex flex-col justify-between h-full group">
      <div>
        <div className="flex justify-between items-start gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/workflows/${workflow.id}`} className="hover:underline shrink-0">
                <h3 className="font-semibold text-base truncate">{workflow.name}</h3>
              </Link>
              <Badge
                variant={optimisticActive ? "default" : "secondary"}
                className={`shrink-0 text-[10px] px-1.5 py-0 h-4 ${optimisticActive ? "bg-green-600 hover:bg-green-700" : ""}`}
              >
                {optimisticActive ? "Active" : "Draft"}
              </Badge>
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-3 shrink-0 ml-2">
              <div className="flex items-center gap-1.5">
                <Switch
                  id={`workflow-status-${workflow.id}`}
                  checked={optimisticActive}
                  onCheckedChange={handleToggle}
                  className="scale-90 data-[state=checked]:bg-green-600"
                />
              </div>
              <WorkflowActionsMenu
                workflow={workflow}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            </div>
          )}
        </div>

        <Link href={`/workflows/${workflow.id}`} className="block">
          {workflow.description ? (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1 mb-4">
              {workflow.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic line-clamp-2 mt-1 mb-4">
              No description added
            </p>
          )}
        </Link>
      </div>

      <div className="mt-auto pt-4 border-t border-border/40">
        <p className="text-[11px] text-muted-foreground/70">
          Updated {new Date(workflow.updatedAt).toLocaleString()}
        </p>
      </div>
    </Card>
  );
}
