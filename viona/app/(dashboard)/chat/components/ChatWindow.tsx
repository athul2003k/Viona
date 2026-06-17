"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useOrgStore } from "@/hooks/useOrgStore";
import { OrganizationState } from "@/components/OrganizationState";
import ChatMessage from "./ChatMessages";
import ChatInput from "./ChatInput";
import type { ChatMessage as Message, AgentOutput } from "../types";
import { Plus, History, X, Trash2, MessageSquare } from "lucide-react";
import {
    fetchSessions,
    fetchSession,
    deleteSession,
    type ChatSession
} from "../lib/sessions";

// WebSocket message types
type WSMessageType = "connected" | "stream" | "complete" | "tool_update" | "error";

interface WSMessage {
    type: WSMessageType;
    session_id?: string;
    message_id?: string;
    output?: AgentOutput;
    delta?: string;
    tool?: string;
    status?: string;
    message?: string;
}

const AI_AGENT_WS_URL = process.env.NEXT_PUBLIC_AI_AGENT_WS_URL || "ws://localhost:8000";

interface ChatWindowProps {
    chatId: string;
    onNewChat?: () => void;
    onSessionCreated?: (sessionId: string) => void;
    onSelectSession?: (sessionId: string) => void;
}

export default function ChatWindow({ chatId, onNewChat, onSessionCreated, onSelectSession }: ChatWindowProps) {
    const { getToken } = useAuth();
    const { selectedOrgId, orgs, setSelectedOrgId } = useOrgStore();

    const [messages, setMessages] = useState<Message[]>([]);
    const [streamingContent, setStreamingContent] = useState<string>("");
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    // Session state — derived from chatId prop (URL is source of truth)
    const isNewChat = chatId === "new";
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
    const streamingMessageIdRef = useRef<string | null>(null);
    const tokenRef = useRef<string | null>(null);
    const selectedOrgIdRef = useRef(selectedOrgId);
    const chatIdRef = useRef(chatId);
    const hasUrlUpdatedRef = useRef(false);
    const intentionalCloseRef = useRef(false);

    // Keep refs in sync
    useEffect(() => {
        selectedOrgIdRef.current = selectedOrgId;
    }, [selectedOrgId]);

    useEffect(() => {
        chatIdRef.current = chatId;
        hasUrlUpdatedRef.current = false;
    }, [chatId]);

    // Store getToken in a ref to avoid dependency issues
    const getTokenRef = useRef(getToken);
    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    // Smart scroll — only auto-scroll if user is near the bottom
    const scrollToBottomIfNeeded = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const threshold = 150;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

        if (isNearBottom) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, []);

    useEffect(() => {
        scrollToBottomIfNeeded();
    }, [messages, streamingContent, scrollToBottomIfNeeded]);

    // Load sessions when history panel is opened
    const loadSessions = useCallback(async () => {
        if (!selectedOrgId) return;

        try {
            setLoadingSessions(true);
            const token = await getToken();
            if (!token) return;

            tokenRef.current = token;
            const sessionList = await fetchSessions(token, selectedOrgId);
            setSessions(sessionList);
        } catch (err) {
            console.error("Failed to load sessions:", err);
        } finally {
            setLoadingSessions(false);
        }
    }, [getToken, selectedOrgId]);

    useEffect(() => {
        if (showHistory) {
            loadSessions();
        }
    }, [showHistory, loadSessions]);

    // Handle incoming WebSocket messages
    const handleWSMessage = useCallback((data: WSMessage) => {
        switch (data.type) {
            case "connected":
                // If this is a new chat, update URL to the server-assigned session
                if (data.session_id && chatIdRef.current === "new" && !hasUrlUpdatedRef.current) {
                    hasUrlUpdatedRef.current = true;
                    onSessionCreated?.(data.session_id);
                }
                break;

            case "stream":
                if (data.delta) {
                    setStreamingContent(prev => prev + data.delta);
                }
                break;

            case "tool_update":
                if (data.status === "running") {
                    setStreamingContent(`Analyzing ${data.tool?.replace(/_/g, " ")}...`);
                }
                break;

            case "complete":
                setIsLoading(false);
                setStreamingContent("");
                if (data.output) {
                    const output = data.output;
                    setMessages(prev => [
                        ...prev,
                        {
                            id: data.message_id || crypto.randomUUID(),
                            role: "assistant",
                            content: output.summary,
                            agentOutput: output
                        }
                    ]);
                }
                // If URL still shows "new", update it
                if (data.session_id && chatIdRef.current === "new" && !hasUrlUpdatedRef.current) {
                    hasUrlUpdatedRef.current = true;
                    onSessionCreated?.(data.session_id);
                }
                streamingMessageIdRef.current = null;
                break;

            case "error":
                setIsLoading(false);
                setStreamingContent("");
                setMessages(prev => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: data.message || "An error occurred"
                    }
                ]);
                break;
        }
    }, [onSessionCreated]);

    // Connect to WebSocket
    const connectWebSocket = useCallback(async (token: string, sessionId?: string) => {
        if (!selectedOrgIdRef.current) return;

        if (wsRef.current) {
            intentionalCloseRef.current = true;
            wsRef.current.close();
        }

        // Reset the flag for the new connection
        intentionalCloseRef.current = false;

        let wsUrl = `${AI_AGENT_WS_URL}/ws/chat?token=${token}&org_id=${selectedOrgIdRef.current}`;
        if (sessionId && sessionId !== "new") {
            wsUrl += `&session_id=${sessionId}`;
        }

        const ws = new WebSocket(wsUrl);
        let pingInterval: NodeJS.Timeout | null = null;

        ws.onopen = () => {
            setIsConnected(true);
            setError(null);
            pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: "ping" }));
                }
            }, 3000);
        };

        ws.onmessage = (event) => {
            const data: WSMessage = JSON.parse(event.data);
            if ((data as any).type === "pong") return;
            handleWSMessage(data);
        };

        ws.onerror = () => {
            setError("Connection error");
            setIsConnected(false);
            if (pingInterval) clearInterval(pingInterval);
        };

        ws.onclose = () => {
            setIsConnected(false);
            if (pingInterval) clearInterval(pingInterval);

            // Only auto-reconnect on unexpected disconnects, not intentional closes
            if (intentionalCloseRef.current) return;

            // Reconnect after 3 seconds with fresh token
            reconnectTimeoutRef.current = setTimeout(async () => {
                if (!selectedOrgIdRef.current) return;
                try {
                    const freshToken = await getTokenRef.current();
                    if (freshToken) {
                        tokenRef.current = freshToken;
                        const sessionForReconnect = chatIdRef.current === "new" ? undefined : chatIdRef.current;
                        await connectWebSocket(freshToken, sessionForReconnect);
                    }
                } catch (err) {
                    console.error("Token refresh failed on reconnect:", err);
                }
            }, 3000);
        };

        wsRef.current = ws;
    }, [handleWSMessage]);

    // Initialize/re-initialize when chatId changes
    useEffect(() => {
        if (!selectedOrgId) return;

        const initializeChat = async () => {
            try {
                const token = await getTokenRef.current();
                if (!token) {
                    setError("Authentication required");
                    return;
                }
                tokenRef.current = token;

                // Clear previous state
                setMessages([]);
                setStreamingContent("");
                setError(null);
                setIsLoading(false);

                // Clear reconnect timeout
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }

                // Close existing WS intentionally
                if (wsRef.current) {
                    intentionalCloseRef.current = true;
                    wsRef.current.close();
                    wsRef.current = null;
                }

                if (isNewChat) {
                    // New chat — connect without session ID, backend will create one
                    await connectWebSocket(token, undefined);
                } else {
                    // Existing session — load messages then connect
                    setLoadingMessages(true);
                    try {
                        const detail = await fetchSession(token, selectedOrgId, chatId);
                        const loadedMessages: Message[] = detail.messages.map((m, i) => ({
                            id: `${chatId}-${i}`,
                            role: m.role as "user" | "assistant",
                            content: m.content,
                            agentOutput: m.agent_output as AgentOutput | undefined
                        }));
                        setMessages(loadedMessages);
                    } catch (err) {
                        console.error("Failed to load session:", err);
                        setError("Failed to load chat session");
                    } finally {
                        setLoadingMessages(false);
                    }

                    await connectWebSocket(token, chatId);
                }
            } catch (err) {
                console.error("Failed to initialize chat:", err);
                setError("Failed to connect");
            }
        };

        initializeChat();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            intentionalCloseRef.current = true;
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [chatId, selectedOrgId, isNewChat, connectWebSocket]);

    // Handle sending messages
    const handleSend = (content: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            setError("Not connected");
            return;
        }

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setStreamingContent("");
        streamingMessageIdRef.current = crypto.randomUUID();

        // Send to server — use chatId as session_id (unless "new")
        wsRef.current.send(JSON.stringify({
            type: "message",
            content,
            session_id: isNewChat ? undefined : chatId,
            message_id: streamingMessageIdRef.current
        }));
    };

    // Handle new chat
    const handleNewChat = () => {
        onNewChat?.();
    };

    // Handle selecting a session from history
    const handleSelectSession = (session: ChatSession) => {
        setShowHistory(false);
        onSelectSession?.(session.id);
    };

    // Handle deleting a session
    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!selectedOrgId || !tokenRef.current) return;

        try {
            await deleteSession(tokenRef.current, selectedOrgId, sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));

            // If we deleted the current session, start a new one
            if (sessionId === chatId) {
                handleNewChat();
            }
        } catch (err) {
            console.error("Failed to delete session:", err);
        }
    };

    // Format date for display
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString();
    };

    if (orgs.length === 0 || !selectedOrgId) {
        return (
            <div className="flex flex-1 min-h-0 relative">
                <OrganizationState 
                    hasOrganizations={orgs.length > 0} 
                    hasSelectedOrg={!!selectedOrgId}
                    orgs={orgs}
                    selectedOrgId={selectedOrgId}
                    onOrganizationSelect={setSelectedOrgId}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-1 min-h-0 relative">
            {/* Main chat area */}
            <div className="flex flex-col flex-1 min-h-0">
                {/* Header with New Chat and History */}
                <div className="flex items-center justify-between px-6 py-3">
                    <button
                        onClick={handleNewChat}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                    >
                        <Plus className="w-4 h-4" />
                        New Chat
                    </button>

                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-lg hover:bg-muted/50 ${showHistory ? 'text-foreground bg-muted/50' : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <History className="w-4 h-4" />
                        History
                    </button>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="px-6 py-2 text-sm text-red-500 text-center">
                        {error}
                    </div>
                )}

                {/* Messages area */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                        {/* Loading messages state */}
                        {loadingMessages && (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                            </div>
                        )}

                        {/* Empty state */}
                        {!loadingMessages && messages.length === 0 && !streamingContent && (
                            <div className="text-center py-20">
                                <h2 className="text-2xl font-semibold text-foreground mb-2">
                                    How can I help you today?
                                </h2>
                                <p className="text-muted-foreground">
                                    Ask me about your inventory, orders, or business analytics.
                                </p>
                            </div>
                        )}

                        {/* Messages */}
                        {messages.map(msg => (
                            <ChatMessage key={msg.id} message={msg} />
                        ))}

                        {/* Streaming content */}
                        {streamingContent && (
                            <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground">Viona</div>
                                <div className="text-foreground leading-relaxed whitespace-pre-wrap">
                                    {streamingContent}
                                    <span className="inline-block w-2 h-4 bg-foreground/60 ml-1 animate-pulse" />
                                </div>
                            </div>
                        )}

                        {/* Loading indicator */}
                        {isLoading && !streamingContent && (
                            <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground">Viona</div>
                                <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} className="h-8" />
                    </div>
                </div>

                {/* Input area */}
                <div className="border-t border-border/30">
                    <div className="max-w-3xl mx-auto px-6 py-4">
                        <ChatInput
                            onSend={handleSend}
                            disabled={isLoading || !isConnected}
                        />
                    </div>
                </div>
            </div>

            {/* History Sidebar */}
            <div
                className={`absolute right-0 top-0 bottom-0 w-80 bg-background border-l border-border/50 shadow-lg transform transition-transform duration-300 ease-in-out z-10 ${showHistory ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* History header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                        <h3 className="text-sm font-semibold text-foreground">Chat History</h3>
                        <button
                            onClick={() => setShowHistory(false)}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* History list */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {loadingSessions ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No chat history yet</p>
                                <p className="text-xs mt-1">Start a conversation to see history</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {sessions.map((session) => (
                                    <div
                                        key={session.id}
                                        onClick={() => handleSelectSession(session)}
                                        className={`group p-3 rounded-lg cursor-pointer transition-colors ${session.id === chatId && !isNewChat
                                            ? 'bg-muted'
                                            : 'hover:bg-muted/50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-foreground truncate">
                                                    {session.title}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {session.message_count} messages • {formatDate(session.updated_at)}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteSession(e, session.id)}
                                                className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Overlay when history is open on mobile */}
            {showHistory && (
                <div
                    className="absolute inset-0 bg-black/20 z-0 lg:hidden"
                    onClick={() => setShowHistory(false)}
                />
            )}
        </div>
    );
}
