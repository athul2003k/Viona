"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSelectedOrg } from "@/hooks/useOrgStore";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { fetchSessions, deleteSession, type ChatSession } from "../lib/sessions";
import { MessageSquare, Trash2, Clock } from "lucide-react";

export default function ChatHistoryPage() {
  const { getToken } = useAuth();
  const selectedOrgId = useSelectedOrg();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!selectedOrgId) return;

    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) {
        setError("Authentication required");
        return;
      }

      const sessionList = await fetchSessions(token, selectedOrgId);
      setSessions(sessionList);
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setError("Failed to load chat history");
    } finally {
      setLoading(false);
    }
  }, [getToken, selectedOrgId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedOrgId) return;

    try {
      const token = await getToken();
      if (!token) return;
      await deleteSession(token, selectedOrgId, sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <p className="text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-6 space-y-3">
      <h2 className="text-xl font-semibold mb-4">Chat History</h2>

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No chat history yet</p>
          <p className="text-sm mt-1">
            Start a new conversation from the{" "}
            <Link href="/chat/new" className="text-primary hover:underline">
              chat page
            </Link>
          </p>
        </div>
      ) : (
        sessions.map(session => (
          <Link key={session.id} href={`/chat/${session.id}`}>
            <Card className="p-4 hover:bg-muted/50 transition-colors group cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{session.title}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {session.message_count} messages
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(session.updated_at)}
                    </span>
                  </div>
                  {session.preview && (
                    <p className="text-sm text-muted-foreground mt-2 truncate">
                      {session.preview}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(e, session.id)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
