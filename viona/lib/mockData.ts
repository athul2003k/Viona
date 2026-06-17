import { FileText, Image as ImageIcon, Film, Music, Archive, Folder } from "lucide-react";

export type FileType = "folder" | "image" | "video" | "audio" | "archive" | "document" | "pdf";

export interface FileItem {
    id: string;
    name: string;
    type: FileType;
    size: string;
    modified: string;
    owner: string;
    starred?: boolean;
    shared?: boolean;
    preview?: string; // Color or image URL
    parentId?: string | null;
    isTrashed?: boolean;
}

export const folders: FileItem[] = [
    { id: "1", name: "Personal Documents", type: "folder", size: "12 items", modified: "Oct 24, 2024", owner: "me", parentId: null },
    { id: "2", name: "Work Projects", type: "folder", size: "24 items", modified: "Sep 15, 2024", owner: "me", starred: true, parentId: null },
    { id: "3", name: "Holiday Photos 2024", type: "folder", size: "156 items", modified: "Jan 02, 2025", owner: "me", parentId: null },
    { id: "4", name: "Shared Resources", type: "folder", size: "8 items", modified: "Yesterday", owner: "Sarah Jenkins", shared: true, parentId: null },
    { id: "13", name: "Invoices & Receipts", type: "folder", size: "4 items", modified: "Nov 30, 2024", owner: "me", parentId: "1" },
    { id: "15", name: "Tax Documents", type: "folder", size: "2 items", modified: "Dec 10, 2024", owner: "me", parentId: "1" },
];

export const files: FileItem[] = [
    { id: "5", name: "Q4 Marketing Strategy.pdf", type: "pdf", size: "2.4 MB", modified: "Today, 10:30 AM", owner: "me", starred: true, parentId: "2" },
    { id: "6", name: "Website Redesign Mockup.fig", type: "image", size: "4.1 MB", modified: "Today, 09:15 AM", owner: "Mike Chen", parentId: "2" },
    { id: "7", name: "Product Demo Walkthrough.mp4", type: "video", size: "145 MB", modified: "Yesterday", owner: "me", parentId: "2" },
    { id: "8", name: "Department Budget 2025.xlsx", type: "document", size: "24 KB", modified: "Last week", owner: "Finance Team", shared: true, parentId: "4" },
    { id: "9", name: "Brand Assets.zip", type: "archive", size: "12 MB", modified: "Dec 10, 2024", owner: "me", parentId: null },
    { id: "10", name: "Client Meeting Notes.docx", type: "document", size: "15 KB", modified: "Dec 05, 2024", owner: "me", parentId: "2" },
    { id: "11", name: "Team Lunch.jpg", type: "image", size: "3.2 MB", modified: "Oct 20, 2024", owner: "Sarah Jenkins", parentId: "3" },
    { id: "12", name: "Podcast Interview.mp3", type: "audio", size: "14 MB", modified: "Sep 28, 2024", owner: "me", parentId: null },
    { id: "14", name: "Project Requirements.txt", type: "document", size: "2 KB", modified: "Aug 15, 2024", owner: "me", parentId: "1" },
];

export const getIconForType = (type: FileType) => {
    switch (type) {
        case "folder": return Folder;
        case "image": return ImageIcon;
        case "video": return Film;
        case "audio": return Music;
        case "archive": return Archive;
        case "pdf": return FileText;
        case "document": return FileText;
        default: return FileText;
    }
};
