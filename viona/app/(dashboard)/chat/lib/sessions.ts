/**
 * Chat Sessions API Client
 * 
 * Client functions for interacting with the sessions REST API.
 */

const AI_AGENT_API_URL = process.env.NEXT_PUBLIC_AI_AGENT_API_URL || "http://localhost:8000";

export interface ChatSession {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
    preview?: string;
}

export interface ChatMessageData {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    agent_output?: Record<string, unknown>;
}

export interface SessionDetail {
    id: string;
    title: string;
    messages: ChatMessageData[];
    created_at: string;
    updated_at: string;
}

/**
 * Fetch all chat sessions for the current org/user.
 */
export async function fetchSessions(
    token: string,
    orgId: string,
    limit: number = 50
): Promise<ChatSession[]> {
    const response = await fetch(`${AI_AGENT_API_URL}/api/sessions?limit=${limit}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "X-Org-Id": orgId,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
    }

    const data = await response.json();
    return data.sessions;
}

/**
 * Fetch a single session with all messages.
 */
export async function fetchSession(
    token: string,
    orgId: string,
    sessionId: string
): Promise<SessionDetail> {
    const response = await fetch(`${AI_AGENT_API_URL}/api/sessions/${sessionId}`, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "X-Org-Id": orgId,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Create a new chat session.
 */
export async function createSession(
    token: string,
    orgId: string,
    title: string = "New Chat"
): Promise<{ id: string; title: string }> {
    const response = await fetch(`${AI_AGENT_API_URL}/api/sessions`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "X-Org-Id": orgId,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
    });

    if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Delete a chat session.
 */
export async function deleteSession(
    token: string,
    orgId: string,
    sessionId: string
): Promise<void> {
    const response = await fetch(`${AI_AGENT_API_URL}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${token}`,
            "X-Org-Id": orgId,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`);
    }
}

/**
 * Update session title.
 */
export async function updateSessionTitle(
    token: string,
    orgId: string,
    sessionId: string,
    title: string
): Promise<void> {
    const response = await fetch(`${AI_AGENT_API_URL}/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${token}`,
            "X-Org-Id": orgId,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
    });

    if (!response.ok) {
        throw new Error(`Failed to update session: ${response.statusText}`);
    }
}
