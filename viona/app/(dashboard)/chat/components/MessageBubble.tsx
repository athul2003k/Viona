import type { Message } from "../types";
import { cn } from "@/lib/utils";

export default function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "max-w-2xl rounded-lg px-4 py-2 text-sm",
        isUser
          ? "ml-auto bg-muted text-foreground"
          : "bg-background border"
      )}
    >
      {message.content}
    </div>
  );
}
