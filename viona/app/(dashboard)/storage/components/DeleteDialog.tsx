import { useEffect } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";

interface DeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  itemName: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmClass?: string;
}

export default function DeleteDialog({
  isOpen,
  onClose,
  onDelete,
  itemName,
  title,
  description,
  confirmLabel,
  confirmClass,
}: DeleteDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === "Enter") {
        e.preventDefault();
        onDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onDelete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1b1e] border border-[#2e3035] rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            {title || "Delete Item?"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-400 mb-6 text-sm">
          {description ?? (
            <>
              Are you sure you want to delete{" "}
              <span className="text-white font-medium">"{itemName}"</span>? This
              action can be undone from the Trash.
            </>
          )}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${confirmClass ?? "bg-red-500 hover:bg-red-600"}`}
          >
            <Trash2 className="w-4 h-4" />
            {confirmLabel ?? "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
