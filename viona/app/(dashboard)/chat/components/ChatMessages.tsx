"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage as MessageType } from "../types";
import { AgentResponseRenderer } from "./AgentResponseRenderer";

interface ChatMessageProps {
  message: MessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  // User messages - clean, right-aligned
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-1">
          <div className="text-xs font-medium text-muted-foreground text-right">You</div>
          <div className="text-foreground leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages with structured output
  if (message.agentOutput) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Viona</div>
        <div className="text-foreground leading-relaxed">
          <AgentResponseRenderer output={message.agentOutput} />
        </div>
      </div>
    );
  }

  // Simple assistant text messages
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Viona</div>
      <div
        className="text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{
          __html: message.content
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br />')
        }}
      />
    </div>
  );
}