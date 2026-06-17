"use client";

import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { EditWorkflowModal } from "./EditWorkflowModal";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { WorkflowListItem } from "../types";

interface WorkflowActionsMenuProps {
    workflow: WorkflowListItem;
    onUpdate: () => void;
    onDelete: () => void;
}

export function WorkflowActionsMenu({
    workflow,
    onUpdate,
    onDelete,
}: WorkflowActionsMenuProps) {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setIsDeleteOpen(true)}
                        className="text-destructive"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <EditWorkflowModal
                workflow={workflow}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={onUpdate}
            />

            <DeleteConfirmDialog
                workflow={workflow}
                open={isDeleteOpen}
                onOpenChange={setIsDeleteOpen}
                onSuccess={onDelete}
            />
        </>
    );
}
