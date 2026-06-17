import { X, FileText, Calendar, HardDrive, Copy, Info } from "lucide-react";
import { FileItem, getIconForType } from "../types";
import { cn } from "@/lib/utils";

interface DetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    file: FileItem | null;
    onCopyLink?: () => void;
}

export default function DetailsDialog({ isOpen, onClose, file, onCopyLink }: DetailsDialogProps) {
    if (!isOpen || !file) return null;

    const Icon = getIconForType(file.type);

    // const handleCopyLink = () => {
    //     navigator.clipboard.writeText(`https://drive.example.com/file/${file.id}`);
    //     // In a real app, you'd show a toast here
    // };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-sm bg-card border border-card-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 flex items-center justify-between border-b border-card-border">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Info className="w-4 h-4 text-primary" />
                        Details
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 flex flex-col items-center border-b border-card-border bg-background/50">
                    <div className="w-24 h-24 bg-background rounded-xl flex items-center justify-center mb-4 shadow-sm border border-card-border">
                        <Icon className={cn("w-12 h-12",
                            file.type === "pdf" ? "text-red-500" :
                                file.type === "video" ? "text-purple-500" :
                                    file.type === "audio" ? "text-yellow-500" :
                                        file.type === "folder" ? "text-primary" :
                                            "text-blue-500"
                        )} />
                    </div>
                    <h4 className="font-medium text-center text-foreground break-all px-4 text-lg">{file.name}</h4>
                    <p className="text-sm text-gray-500 mt-1 capitalize">{file.type}</p>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <h5 className="text-xs font-semibold text-gray-500 uppercase mb-4 tracking-wider">Information</h5>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 flex items-center gap-2"><HardDrive className="w-4 h-4" /> Size</span>
                                <span className="text-foreground font-medium">{file.size}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 flex items-center gap-2"><FileText className="w-4 h-4" /> Type</span>
                                <span className="text-foreground font-medium capitalize">{file.type}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 flex items-center gap-2"><Calendar className="w-4 h-4" /> Modified</span>
                                <span className="text-foreground font-medium">{file.updatedAt ? new Date(file.updatedAt).toLocaleDateString() : ''}</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h5 className="text-xs font-semibold text-gray-500 uppercase mb-4 tracking-wider">Owner</h5>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-card-border">
                            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold ring-2 ring-background">
                                {file.owner === 'me' ? 'AM' : (file.owner?.charAt(0) || 'U')}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-foreground">{file.owner === 'me' ? 'Alex Morgan' : (file.owner || 'Unknown')}</div>
                                <div className="text-xs text-gray-500">{file.owner === 'me' ? 'Owner' : 'Editor'}</div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onCopyLink}
                        className="w-full py-2.5 flex items-center justify-center gap-2 border border-card-border rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-all active:scale-[0.98]"
                    >
                        <Copy className="w-4 h-4" />
                        Copy Link
                    </button>
                </div>
            </div>
        </div>
    );
}
