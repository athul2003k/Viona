import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Key, ShieldCheck, MoreVertical, Edit } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CredentialListItem } from "../types";

interface CredentialCardProps {
    credential: CredentialListItem;
    onDelete: () => Promise<void>;
    onEdit?: () => void;
    canManage: boolean;
}

export function CredentialCard({ credential, onDelete, onEdit, canManage }: CredentialCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!canManage) return;
        try {
            setIsDeleting(true);
            await onDelete();
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Card className="flex flex-col h-full bg-card hover:shadow-md transition-shadow relative overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-md">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-semibold text-lg leading-none tracking-tight truncate max-w-[180px]">
                            {credential.name}
                        </h3>
                        <p className="text-xs text-muted-foreground uppercase font-medium">
                            {credential.type}
                        </p>
                    </div>
                </div>

                {canManage && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="-mr-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {onEdit && (
                                <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit credential
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="text-destructive focus:text-destructive cursor-pointer"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {isDeleting ? "Deleting..." : "Delete credential"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </CardHeader>

            <CardContent className="flex-1 py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-3 rounded-md font-mono">
                    <Key className="w-4 h-4 shrink-0" />
                    <span className="truncate">{credential.value}</span>
                </div>
            </CardContent>

            <CardFooter className="pt-2 pb-4 text-xs text-muted-foreground justify-between">
                <span>Added {formatDistanceToNow(new Date(credential.createdAt), { addSuffix: true })}</span>
            </CardFooter>
        </Card>
    );
}
