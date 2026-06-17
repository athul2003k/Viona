import { MoreVertical } from "lucide-react";
import { FileItem, getIconForType, formatFileSize } from "../types";
import { cn } from "@/lib/utils";

interface FileListProps {
  items: FileItem[];
  selectedId?: string | null;
  onSelect?: (item: FileItem) => void;
  onDoubleClick?: (item: FileItem) => void;
  onContextMenu?: (e: React.MouseEvent, item: FileItem) => void;
}

export default function FileList({
  items,
  selectedId,
  onSelect,
  onDoubleClick,
  onContextMenu,
}: FileListProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-xs font-medium text-gray-500 border-b border-gray-200 dark:border-[#2e3035]">
        <div className="w-8"></div>
        <div>Name</div>
        <div>Owner</div>
        <div>Date Modified</div>
        <div>Size</div>
        <div className="w-10"></div>
      </div>

      <div className="flex flex-col">
        {items.map((item) => {
          const Icon = getIconForType(item.type);
          const isSelected = selectedId === item.id;

          return (
            <div
              key={item.id}
              onClick={() => onSelect?.(item)}
              onDoubleClick={() => onDoubleClick?.(item)}
              onContextMenu={(e) => onContextMenu?.(e, item)}
              className={cn(
                // Base styles
                "grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 items-center border-b transition-colors group cursor-pointer",

                // Border colors (Light vs Dark)
                "border-gray-100 dark:border-[#2e3035]/50",

                // Conditional Selection and Hover styles
                isSelected
                  ? "bg-primary/10 border-primary/20"
                  : "hover:bg-gray-100 dark:hover:bg-[#25262b]", // <--- CHANGED HERE
              )}
            >
              <div className="w-8 flex items-center justify-center">
                <Icon
                  className={cn(
                    "w-5 h-5",
                    item.type === "pdf" || item.type === "application/pdf"
                      ? "text-red-500"
                      : item.type === "video" || item.type.startsWith("video/")
                        ? "text-purple-500"
                        : item.type === "audio" ||
                            item.type.startsWith("audio/")
                          ? "text-yellow-500"
                          : item.type === "folder"
                            ? "text-primary fill-primary/10"
                            : item.type.startsWith("image/")
                              ? "text-green-500"
                              : "text-blue-500",
                  )}
                />
              </div>
              <div
                className={cn(
                  "text-sm font-medium truncate",
                  isSelected ? "text-primary" : "text-foreground",
                )}
              >
                {item.name}
              </div>
              <div className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
                {item.owner}
              </div>
              <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                {item.updatedAt
                  ? new Date(item.updatedAt).toLocaleDateString()
                  : ""}
              </div>
              <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                {formatFileSize(item.size)}
              </div>
              <div className="w-10 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onContextMenu?.(e, item);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
