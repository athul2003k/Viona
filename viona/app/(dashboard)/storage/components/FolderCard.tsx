import { Folder, MoreVertical } from "lucide-react";
import { FileItem } from "../types";
import { cn } from "@/lib/utils";

interface FolderCardProps {
    folder: FileItem;
    selected?: boolean;
    onClick?: () => void;
    onDoubleClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
}

export default function FolderCard({ folder, selected, onClick, onDoubleClick, onContextMenu }: FolderCardProps) {
    return (
        <div
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
            className={cn(
                "group relative p-4 bg-card border rounded-xl transition-all cursor-pointer",
                selected
                    ? "border-primary bg-[#primary]/5 ring-1 ring-primary"
                    : "border-card-border hover:bg-white/5 hover:border-white/10"
            )}
        >
            <div className="flex items-start justify-between mb-3">
                <Folder className={cn("w-8 h-8 transition-colors", selected ? "text-primary fill-primary/20" : "text-primary fill-primary/10")} />
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onContextMenu?.(e);
                    }}
                    className="p-1 text-gray-500 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <MoreVertical className="w-4 h-4" />
                </button>
            </div>
            <div>
                <p className="text-sm font-medium text-foreground truncate mb-1">{folder.name}</p>
                <p className="text-xs text-gray-500">{folder.updatedAt ? new Date(folder.updatedAt).toLocaleDateString() : ''}</p>
            </div>
        </div>
    );
}
