"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import ChatWindow from "../components/ChatWindow";

export default function ChatPage() {
    const { chatId } = useParams<{ chatId: string }>();
    const router = useRouter();

    const handleNewChat = useCallback(() => {
        router.push("/chat/new");
    }, [router]);

    // When backend assigns a session ID, update URL without full navigation
    const handleSessionCreated = useCallback((sessionId: string) => {
        router.replace(`/chat/${sessionId}`, { scroll: false });
    }, [router]);

    // When a session is selected from history, navigate to it
    const handleSelectSession = useCallback((sessionId: string) => {
        router.push(`/chat/${sessionId}`);
    }, [router]);

    return (
        <ChatWindow
            chatId={chatId}
            onNewChat={handleNewChat}
            onSessionCreated={handleSessionCreated}
            onSelectSession={handleSelectSession}
        />
    );
}
