"use client";

import {
  Search,
  Upload,
  FolderPlus,
  Download,
  Trash2,
  Link as LinkIcon,
  Share2,
  Grid,
  List as ListIcon,
  Info,
  Edit2,
  ClipboardPaste,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface ToolbarProps {
  viewMode: "grid" | "list";
  onViewChange: (mode: "grid" | "list") => void;
  onNewFolder?: () => void;
  onUpload?: () => void;
  onToggleDetails?: () => void;
  isDetailsOpen?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
  onCopyLink?: () => void;
  onTrashClick?: () => void;
  hasSelection?: boolean;
  pageView?: "drive" | "trash";
  onEmptyTrash?: () => void;
  onRestore?: () => void;
  onRestoreAll?: () => void;
  onDeleteForever?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  usagePercent?: number;
  usedBytes?: number;
  clipboardItemName?: string | null;
  onPaste?: () => void;
}

export default function Toolbar({
  viewMode,
  onViewChange,
  onNewFolder,
  onUpload,
  onToggleDetails,
  isDetailsOpen,
  onRename,
  onDelete,
  onCopyLink,
  onTrashClick,
  hasSelection,
  pageView = "drive",
  onEmptyTrash,
  onRestore,
  onRestoreAll,
  onDeleteForever,
  searchQuery = "",
  onSearchChange,
  usagePercent = 0,
  usedBytes = 0,
  clipboardItemName,
  onPaste,
}: ToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-card rounded-xl border border-border gap-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        {pageView === "trash" ? (
          <>
            <button
              onClick={onEmptyTrash}
              className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 flex-1 md:flex-initial min-w-[120px] md:min-w-[140px] bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Empty Trash</span>
            </button>
            <button
              onClick={onRestoreAll}
              className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 flex-1 md:flex-initial min-w-[120px] md:min-w-[140px] bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-lg text-sm font-medium transition-colors"
            >
              <div className="w-4 h-4 -scale-x-100 rotate-180">
                <Share2 className="w-4 h-4" />
              </div>
              <span className="hidden sm:inline">Restore All</span>
              <span className="sm:hidden">Restore</span>
            </button>

            <div className="hidden md:block w-px h-8 bg-border mx-2" />

            <button
              onClick={onRestore}
              disabled={!hasSelection}
              className={cn(
                "flex items-center justify-center gap-2 px-3 md:px-4 py-2 flex-1 md:flex-initial min-w-[100px] md:min-w-[140px] border rounded-lg text-sm font-medium transition-colors",
                hasSelection
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground border-transparent shadow-md"
                  : "bg-muted text-muted-foreground border-border cursor-not-allowed",
              )}
            >
              <div className="w-4 h-4 -scale-x-100 rotate-180">
                <Share2 className="w-4 h-4" />
              </div>
              <span>Restore</span>
            </button>
            <button
              onClick={onDeleteForever}
              disabled={!hasSelection}
              className={cn(
                "flex items-center justify-center gap-2 px-3 md:px-4 py-2 flex-1 md:flex-initial min-w-[100px] md:min-w-[140px] border rounded-lg text-sm font-medium transition-colors",
                hasSelection
                  ? "bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/20"
                  : "bg-muted text-muted-foreground border-border cursor-not-allowed",
              )}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onUpload}
              className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 flex-1 md:flex-initial min-w-[120px] md:min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span className="whitespace-nowrap">Upload File</span>
            </button>
            <button
              onClick={onNewFolder}
              className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 flex-1 md:flex-initial min-w-[120px] md:min-w-[140px] bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-lg text-sm font-medium transition-colors"
            >
              <FolderPlus className="w-4 h-4 text-muted-foreground" />
              <span className="whitespace-nowrap">New Folder</span>
            </button>
            <button
              onClick={onTrashClick}
              className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 flex-1 md:flex-initial min-w-[100px] md:min-w-[140px] bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4 text-muted-foreground" />
              <span>Trash</span>
            </button>
            {clipboardItemName && (
              <button
                onClick={onPaste}
                className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 flex-1 md:flex-initial min-w-[120px] md:min-w-[140px] bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border rounded-lg text-sm font-medium transition-colors"
              >
                <ClipboardPaste className="w-4 h-4 text-muted-foreground" />
                <span className="whitespace-nowrap truncate max-w-[120px]">
                  Paste "{clipboardItemName}"
                </span>
              </button>
            )}
          </>
        )}
        <div className="hidden lg:block w-px h-8 bg-border mx-2" />

        <div className="hidden lg:flex items-center gap-4 px-2">
          <div className="flex flex-col gap-1 min-w-[140px]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Storage</span>
              <span className="text-primary">
                {usagePercent.toFixed(1)}% used
              </span>
            </div>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-9 pr-4 py-1.5 bg-muted/50 border border-input rounded-lg text-sm text-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-all placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border shrink-0">
          <button
            onClick={() => onViewChange("grid")}
            className={cn(
              "p-1.5 rounded-md transition-all",
              viewMode === "grid"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewChange("list")}
            className={cn(
              "p-1.5 rounded-md transition-all",
              viewMode === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
