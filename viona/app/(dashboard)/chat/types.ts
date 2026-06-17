export type ChatId = string;

export type ChatRole = "user" | "assistant";

export interface Message {
  id: string;
  chatId: ChatId;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface ChatSummary {
  id: ChatId;
  title: string;
  createdAt: string;
}

// Agent output structure from backend
export interface AgentOutput {
  type: "text" | "chart" | "table" | "action";
  payload: Record<string, unknown>;
  summary: string;
  confidence: number;
  suggestions?: string[];
}

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  agentOutput?: AgentOutput; // Full structured output from agent
};