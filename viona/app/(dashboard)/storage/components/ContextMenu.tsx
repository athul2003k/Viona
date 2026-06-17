import { useEffect, useRef, useLayoutEffect, useState } from "react";
import {
  Download,
  Link as LinkIcon,
  Share2,
  Edit2,
  Trash2,
  FolderInput,
  Info,
  Copy,
  Scissors,
  ClipboardPaste,
} from "lucide-react";
import { FileItem } from "../types";


interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: string) => void;
  isTrashed?: boolean;
  clipboardItem?: FileItem | null;
  clipboardOp?: "copy" | "cut" | null;
}

export default function ContextMenu({
  x,
  y,
  onClose,
  onAction,
  isTrashed,
  clipboardItem,
  clipboardOp,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: y, left: x });

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const { innerWidth, innerHeight } = window;

      let newLeft = x;
      let newTop = y;

      if (x + rect.width > innerWidth) {
        newLeft = x - rect.width;
      }

      if (y + rect.height > innerHeight) {
        newTop = y - rect.height;
      }

      setPosition({ top: newTop, left: newLeft });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Reusable styles for standard menu items
  const menuItemClass =
    "px-4 py-2 text-sm flex items-center gap-3 text-left transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#25262b] hover:text-gray-900 dark:hover:text-white";

  // Reusable style for the divider
  const dividerClass = "h-px bg-gray-200 dark:bg-[#2e3035] my-1";

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-56 bg-white dark:bg-[#1a1b1e] border border-gray-200 dark:border-[#2e3035] rounded-xl shadow-2xl py-2 flex flex-col"
      style={{ top: position.top, left: position.left }}
    >
      {!isTrashed && (
        <>
          <button onClick={() => onAction("open")} className={menuItemClass}>
            <FolderInput className="w-4 h-4" /> Open
          </button>
          <div className={dividerClass} />
          <button onClick={() => onAction("rename")} className={menuItemClass}>
            <Edit2 className="w-4 h-4" /> Rename
          </button>
          <button onClick={() => onAction("copy")} className={menuItemClass}>
            <Copy className="w-4 h-4" /> Copy
          </button>
          <button onClick={() => onAction("cut")} className={menuItemClass}>
            <Scissors className="w-4 h-4" /> Cut
          </button>
          {clipboardItem && (
            <button onClick={() => onAction("paste")} className={menuItemClass}>
              <ClipboardPaste className="w-4 h-4" />
              Paste "{clipboardItem.name}"
              {clipboardOp === "cut" ? " (Move)" : " (Copy)"}
            </button>
          )}

          {/* <button onClick={() => onAction('share')} className={menuItemClass}>
                        <Share2 className="w-4 h-4" /> Share
                    </button> */}
          <button onClick={() => onAction("link")} className={menuItemClass}>
            <LinkIcon className="w-4 h-4" /> Get Link
          </button>
          <button
            onClick={() => onAction("download")}
            className={menuItemClass}
          >
            <Download className="w-4 h-4" /> Download
          </button>
          <div className={dividerClass} />
          <button onClick={() => onAction("details")} className={menuItemClass}>
            <Info className="w-4 h-4" /> Details
          </button>
          <div className={dividerClass} />
        </>
      )}

      {isTrashed && (
        <>
          <button
            onClick={() => onAction("restore")}
            className="px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 flex items-center gap-3 text-left transition-colors"
          >
            <Share2 className="w-4 h-4 -scale-x-100 rotate-180" /> Restore
          </button>
          <div className={dividerClass} />
        </>
      )}

      <button
        onClick={() => onAction("delete")}
        className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 flex items-center gap-3 text-left transition-colors"
      >
        <Trash2 className="w-4 h-4" /> {isTrashed ? "Delete Forever" : "Delete"}
      </button>
    </div>
  );
}
