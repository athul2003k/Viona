"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export default function ChatInput({
  onSend,
  disabled = false,
}: {
  onSend: (value: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
  };

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-2 rounded-2xl bg-muted/50 border border-border/50 p-2">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask anything about your business..."
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-40 overflow-y-auto"
          style={{
            minHeight: "40px",
            maxHeight: "160px"
          }}
        />

        <button
          onClick={submit}
          disabled={!value.trim() || disabled}
          className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all ${value.trim() && !disabled
            ? "bg-foreground text-background hover:bg-foreground/90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <p className="text-[11px] text-center text-muted-foreground/70 mt-2">
        Viona can make mistakes. Verify important information.
      </p>
    </div>
  );
}