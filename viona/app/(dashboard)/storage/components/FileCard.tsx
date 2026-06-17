import { MoreVertical } from "lucide-react";
import { FileItem, getIconForType, formatFileSize } from "../types";
import { cn } from "@/lib/utils";

interface FileCardProps {
  file: FileItem;
  selected?: boolean;
  previewUrl?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export default function FileCard({
  file,
  selected,
  previewUrl,
  onClick,
  onDoubleClick,
  onContextMenu,
}: FileCardProps) {
  const Icon = getIconForType(file.type);
  const isImage = file.type === "image" || file.type.startsWith("image/");
  const isPdf = file.type === "pdf" || file.type === "application/pdf";
  const isVideo = file.type === "video" || file.type.startsWith("video/");


  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      className={cn(
        // Base layout & Animation Physics
        // 'duration-300 ease-in-out' makes the 3D lift feel smooth/heavy
        "group relative rounded-xl transition-all duration-300 ease-in-out cursor-pointer overflow-hidden flex flex-col",

        // ------------------------------------------------------------------
        // 1. RESTING STATE (The "Dull" Look)
        // ------------------------------------------------------------------
        // bg-slate-50: Dull off-white background
        // shadow-inner: Subtle depth making it look pressed in
        !selected &&
          "bg-slate-50 border border-slate-200 shadow-inner dark:bg-card dark:border-border dark:shadow-none",

        // ------------------------------------------------------------------
        // 2. HOVER STATE (The "3D Pop" Effect)
        // ------------------------------------------------------------------
        // hover:-translate-y-1: Moves the card UP by 4px
        // hover:shadow-xl: Adds a large soft shadow underneath
        // hover:bg-white: Brightens the background slightly (like it's catching light)
        !selected &&
          "hover:-translate-y-1 hover:shadow-xl hover:bg-white hover:border-slate-300 dark:hover:bg-accent/50 dark:hover:border-accent",

        // ------------------------------------------------------------------
        // 3. SELECTED STATE
        // ------------------------------------------------------------------
        selected &&
          "border border-primary ring-1 ring-primary bg-primary/5 shadow-none",
      )}
    >
      {/* Thumbnail Section */}
<div className="relative aspect-[4/3] bg-white dark:bg-muted/30 w-full flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-border">
  {previewUrl && isImage ? (
    <img
      src={previewUrl}
      alt={file.name}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  ) : previewUrl && isPdf ? (
    <iframe
      src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
      className="w-full h-full pointer-events-none"
      title={file.name}
    />
  ) : previewUrl && isVideo ? (
    <video
      src={previewUrl}
      className="w-full h-full object-cover"
      muted
      preload="metadata"
    />
  ) : (
    <div className={cn(
      "w-full h-full flex items-center justify-center group-hover:scale-105 transition-transform duration-500",
      isImage && "bg-gradient-to-br from-slate-100 to-slate-200 dark:from-muted/50 dark:to-muted"
    )}>
      <Icon
        className={cn(
          "w-12 h-12",
          file.type === "pdf" || file.type === "application/pdf"
            ? "text-red-500"
            : file.type === "video" || file.type.startsWith("video/")
              ? "text-purple-500"
              : file.type === "audio" || file.type.startsWith("audio/")
                ? "text-yellow-500"
                : file.type.startsWith("image/")
                  ? "text-green-500"
                  : "text-blue-500",
        )}
      />
    </div>
  )}

  {/* Context Menu Button */}
  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
    <button
      onClick={(e) => {
        e.stopPropagation();
        onContextMenu?.(e);
      }}
      className="p-1 bg-white/90 dark:bg-black/50 hover:bg-white dark:hover:bg-black/70 text-slate-700 dark:text-white rounded backdrop-blur-sm border border-slate-200 dark:border-white/10 shadow-sm"
    >
      <MoreVertical className="w-4 h-4" />
    </button>
  </div>
</div>


      {/* Details Section */}
      <div className="p-3">
        <h3
          className={cn(
            "text-sm font-medium truncate mb-1",
            selected ? "text-primary" : "text-slate-700 dark:text-foreground",
          )}
          title={file.name}
        >
          {file.name}
        </h3>

        <p className="text-xs text-slate-500 dark:text-muted-foreground">
          {formatFileSize(file.size)} •{" "}
          {file.updatedAt ? new Date(file.updatedAt).toLocaleDateString() : ""}
        </p>
      </div>
    </div>
  );
}
