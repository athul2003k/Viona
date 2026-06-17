import { useState } from "react";
import { X, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewFolderDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string) => void;
}

export default function NewFolderDialog({ isOpen, onClose, onCreate }: NewFolderDialogProps) {
    const [name, setName] = useState("Untitled Folder");

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreate(name);
        setName("Untitled Folder");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-[#1a1b1e] border border-[#2e3035] rounded-xl shadow-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FolderPlus className="w-5 h-5 text-primary" />
                        New Folder
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-[#141517] border border-[#2e3035] rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 mb-6"
                        autoFocus
                    />

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-emerald-600 transition-colors"
                        >
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
