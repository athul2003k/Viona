import { FileText, Image as ImageIcon, Film, Music, Archive, Folder } from "lucide-react";

export interface FileItem {
    id: string;
    name: string;
    type: string;         // "folder" | "image" | "pdf" | "document" etc.
    size: string | number;
    mimeType?: string;
    parentId: string | null;
    isTrashed?: boolean;
    isStarred?: boolean;
    createdAt?: string;
    updatedAt?: string;
    owner?: string;
    previewUrl?: string;   // signed URL for thumbnail/preview
}

export const getIconForType = (type: string) => {
    switch (type) {
        case "folder": return Folder;
        case "image": return ImageIcon;
        case "video": return Film;
        case "audio": return Music;
        case "archive": return Archive;
        case "pdf": return FileText;
        case "document": return FileText;
        default:
            if (type.startsWith("image/")) return ImageIcon;
            if (type.startsWith("video/")) return Film;
            if (type.startsWith("audio/")) return Music;
            if (type === "application/pdf") return FileText;
            if (type === "application/zip" || type === "application/x-zip-compressed") return Archive;
            return FileText;
    }
};

export function formatFileSize(bytes: string | number): string {
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!b || isNaN(b)) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

