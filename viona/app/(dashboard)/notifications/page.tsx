// viona/app/notifications/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useCurrentUser,
  useOrganizations,
  useSelectedOrg,
  useOrgStore,
} from "@/hooks/useOrgStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  Check,
  Trash2,
  Mail,
  Package,
  Calendar,
  Shield,
  Loader2,
  CheckCheck,
  Archive,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { useUser } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";

// -------------------------------------------------------------
// Types & Constants
// -------------------------------------------------------------

interface Notification {
  id?: string;
  _id?: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: "message" | "order" | "reminder" | "system" | "default";
  priority: "LOW" | "MEDIUM" | "HIGH";
  link?: string;
}

interface NormalizedNotification extends Omit<Notification, "id" | "_id"> {
  id: string;
}

type FilterType = "all" | "unread" | "read";

const icons = {
  message: Mail,
  order: Package,
  reminder: Calendar,
  system: Shield,
  default: Bell,
};

const priorityColors = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-gray-400",
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const secs = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (secs < 60) return "Just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// Helper function to normalize notification ID (handles MongoDB _id)
const normalizeNotification = (n: Notification): NormalizedNotification => ({
  ...n,
  id: n.id || n._id || "",
});

// -------------------------------------------------------------
// Component
// -------------------------------------------------------------

export default function NotificationsPage() {
  const { user: clerkUser } = useUser();
  const user = useCurrentUser();
  const orgs = useOrganizations();
  const selectedOrgId = useSelectedOrg();
  const setSelectedOrgId = useOrgStore((state) => state.setSelectedOrgId);
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<NormalizedNotification[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [sseConnected, setSseConnected] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(true);

  const pendingOperations = useRef<Map<string, AbortController>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  const NOTIFICATION_SERVER_URL =
    process.env.NEXT_PUBLIC_NOTIFICATION_SERVER_URL;

  const userId = user?.id;
  const MAX_RECONNECT_ATTEMPTS = 5;

  const isServerConfigured =
    NOTIFICATION_SERVER_URL &&
    NOTIFICATION_SERVER_URL !== "" &&
    NOTIFICATION_SERVER_URL !== "undefined";

  // -------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread" && n.read) return false;
    if (filter === "read" && !n.read) return false;

    if (search) {
      const lower = search.toLowerCase();
      return (
        n.title.toLowerCase().includes(lower) ||
        n.message.toLowerCase().includes(lower)
      );
    }

    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // -------------------------------------------------------------
  // Fetch Notifications
  // -------------------------------------------------------------

  const fetchNotifications = useCallback(async () => {
    if (!userId || !isServerConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(
        `${NOTIFICATION_SERVER_URL}/notifications?userId=${userId}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      // Normalize notifications to always have 'id' field
      const normalizedNotifications = (data.notifications ?? []).map(
        (n: Notification) => normalizeNotification(n)
      );
      setNotifications(normalizedNotifications);
      setServerAvailable(true);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.error("Request timeout");
        } else {
          console.error("Failed to fetch notifications:", error);
          setServerAvailable(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId, NOTIFICATION_SERVER_URL, isServerConfigured]);

  // -------------------------------------------------------------
  // Mark as Read (Optimistic Update)
  // -------------------------------------------------------------

  const markAsRead = async (id: string) => {
    if (!userId || !isServerConfigured || !id) {
      console.error("Cannot mark as read: missing id or userId", { id, userId });
      return;
    }

    const existingController = pendingOperations.current.get(id);
    if (existingController) {
      existingController.abort();
    }

    const controller = new AbortController();
    pendingOperations.current.set(id, controller);

    setProcessingIds((prev) => new Set(prev).add(id));

    const previousNotifications = [...notifications];
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      const res = await fetch(
        `${NOTIFICATION_SERVER_URL}/notifications/${id}/read?userId=${userId}`,
        {
          method: "PATCH",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      pendingOperations.current.delete(id);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setNotifications(previousNotifications);
        toast({
          title: "Error",
          description: "Failed to mark notification as read.",
          variant: "destructive",
        });
        console.error("Failed to mark as read:", error);
      }
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // -------------------------------------------------------------
  // Mark All as Read (Sequential API calls)
  // -------------------------------------------------------------

  const markAllAsRead = async () => {
    if (!userId || !isServerConfigured) return;

    const unreadNotifications = notifications.filter((n) => !n.read && n.id);
    if (unreadNotifications.length === 0) {
      toast({
        title: "All caught up!",
        description: "No unread notifications.",
      });
      return;
    }

    setLoading(true);
    const previousNotifications = [...notifications];

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      const results = await Promise.allSettled(
        unreadNotifications.map((n) =>
          fetch(
            `${NOTIFICATION_SERVER_URL}/notifications/${n.id}/read?userId=${userId}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
            }
          )
        )
      );

      const failedCount = results.filter((r) => r.status === "rejected").length;

      if (failedCount > 0) {
        toast({
          title: "Partial Success",
          description: `Marked ${unreadNotifications.length - failedCount} of ${unreadNotifications.length} as read.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Marked ${unreadNotifications.length} notifications as read.`,
        });
      }
    } catch (error) {
      setNotifications(previousNotifications);
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read.",
        variant: "destructive",
      });
      console.error("Failed to mark all as read:", error);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Delete Notification (Optimistic Update)
  // -------------------------------------------------------------

  const deleteNotification = async (id: string) => {
    if (!userId || !isServerConfigured || !id) {
      console.error("Cannot delete: missing id or userId", { id, userId });
      return;
    }

    const existingController = pendingOperations.current.get(id);
    if (existingController) {
      existingController.abort();
    }

    const controller = new AbortController();
    pendingOperations.current.set(id, controller);

    setProcessingIds((prev) => new Set(prev).add(id));

    const previousNotifications = [...notifications];
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      const res = await fetch(
        `${NOTIFICATION_SERVER_URL}/notifications/${id}?userId=${userId}`,
        {
          method: "DELETE",
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      pendingOperations.current.delete(id);
      toast({
        title: "Deleted",
        description: "Notification deleted successfully.",
      });
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setNotifications(previousNotifications);
        toast({
          title: "Error",
          description: "Failed to delete notification.",
          variant: "destructive",
        });
        console.error("Failed to delete notification:", error);
      }
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // -------------------------------------------------------------
  // Clear All Read Notifications (Sequential Delete)
  // -------------------------------------------------------------

  const clearAllRead = async () => {
    if (!userId || !isServerConfigured) return;

    const readNotifications = notifications.filter((n) => n.read && n.id);
    if (readNotifications.length === 0) {
      toast({
        title: "No notifications",
        description: "No read notifications to clear.",
      });
      return;
    }

    setLoading(true);
    const previousNotifications = [...notifications];

    setNotifications((prev) => prev.filter((n) => !n.read));

    try {
      const results = await Promise.allSettled(
        readNotifications.map((n) =>
          fetch(
            `${NOTIFICATION_SERVER_URL}/notifications/${n.id}?userId=${userId}`,
            {
              method: "DELETE",
            }
          )
        )
      );

      const failedCount = results.filter((r) => r.status === "rejected").length;

      if (failedCount > 0) {
        await fetchNotifications();
        toast({
          title: "Partial Success",
          description: `Cleared ${readNotifications.length - failedCount} of ${readNotifications.length} notifications.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Cleared ${readNotifications.length} read notifications.`,
        });
      }
    } catch (error) {
      setNotifications(previousNotifications);
      toast({
        title: "Error",
        description: "Failed to clear read notifications.",
        variant: "destructive",
      });
      console.error("Failed to clear read notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Real-time Updates with SSE
  // -------------------------------------------------------------

  useEffect(() => {
    if (!userId || !isServerConfigured) return;

    const connectSSE = () => {
      try {
        const sseUrl = `${NOTIFICATION_SERVER_URL}/notifications/stream?userId=${userId}`;
        const eventSource = new EventSource(sseUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log("✅ SSE Connected");
          reconnectAttemptsRef.current = 0;
          setSseConnected(true);
          setServerAvailable(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const notification = JSON.parse(event.data);
            const normalizedNotification = normalizeNotification(notification);

            if (normalizedNotification.id) {
              setNotifications((prev) => {
                const exists = prev.some((n) => n.id === normalizedNotification.id);
                if (exists) return prev;
                return [normalizedNotification, ...prev];
              });

              toast({
                title: normalizedNotification.title,
                description: normalizedNotification.message,
              });
            }
          } catch (error) {
            console.error("Failed to parse SSE message:", error);
          }
        };

        eventSource.onerror = (error) => {
          console.error("❌ SSE error:", error);
          console.error("Connection state:", eventSource.readyState);
          setSseConnected(false);
          eventSource.close();

          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttemptsRef.current),
              30000
            );
            reconnectAttemptsRef.current++;

            console.log(
              `🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              connectSSE();
            }, delay);
          } else {
            console.error("Max reconnection attempts reached");
            setServerAvailable(false);
          }
        };
      } catch (error) {
        console.error("Failed to establish SSE connection:", error);
        setSseConnected(false);
      }
    };

    connectSSE();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setSseConnected(false);
      }
    };
  }, [userId, NOTIFICATION_SERVER_URL, isServerConfigured, toast]);

  // -------------------------------------------------------------
  // Initial Fetch & Cleanup
  // -------------------------------------------------------------

  useEffect(() => {
    if (userId && isServerConfigured) {
      fetchNotifications();
    }
  }, [userId, isServerConfigured, fetchNotifications]);

  useEffect(() => {
    return () => {
      pendingOperations.current.forEach((controller) => controller.abort());
      pendingOperations.current.clear();
    };
  }, []);

  // -------------------------------------------------------------
  // UI Layout
  // -------------------------------------------------------------

  return (
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="space-y-4 p-4 md:p-8">
            {!isServerConfigured && (
              <Card className="border-yellow-500/50 bg-yellow-500/10">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <WifiOff className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-yellow-900 dark:text-yellow-100">
                        Notification Server Not Configured
                      </h3>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                        Set NEXT_PUBLIC_NOTIFICATION_SERVER_URL in your
                        environment to enable notifications.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isServerConfigured && !serverAvailable && !loading && (
              <Card className="border-red-500/50 bg-red-500/10">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <WifiOff className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-red-900 dark:text-red-100">
                        Unable to Connect to Notification Server
                      </h3>
                      <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                        The notification server at {NOTIFICATION_SERVER_URL} is
                        not responding. Please check if the server is running.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={fetchNotifications}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Connection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="bg-card rounded-xl shadow-sm p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold">Notifications</h1>
                    {sseConnected && (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Stay updated with your latest alerts and messages.
                    {unreadCount > 0 && (
                      <span className="ml-2 text-primary font-medium">
                        ({unreadCount} unread)
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchNotifications}
                    disabled={loading || !isServerConfigured}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </Button>
                  {unreadCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={markAllAsRead}
                      disabled={loading || !isServerConfigured}
                    >
                      <CheckCheck className="h-4 w-4 mr-2" />
                      Mark All Read
                    </Button>
                  )}
                  {notifications.some((n) => n.read) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllRead}
                      disabled={loading || !isServerConfigured}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Clear Read
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex gap-2">
                  <Button
                    variant={filter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    variant={filter === "unread" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("unread")}
                  >
                    Unread {unreadCount > 0 && `(${unreadCount})`}
                  </Button>
                  <Button
                    variant={filter === "read" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter("read")}
                  >
                    Read
                  </Button>
                </div>

                <Input
                  placeholder="Search notifications..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full md:w-64 md:ml-auto"
                />
              </div>

              {loading && notifications.length === 0 && (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loading && filteredNotifications.length === 0 && (
                <Card className="p-10 text-center">
                  <div className="mx-auto w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mb-4">
                    <Bell className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <h2 className="text-lg font-medium">No notifications</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {search
                      ? "No notifications match your search."
                      : filter === "unread"
                        ? "You're all caught up!"
                        : "You'll see updates here once there's activity."}
                  </p>
                </Card>
              )}

              {!loading && filteredNotifications.length > 0 && (
                <ScrollArea className="h-[calc(100vh-300px)] rounded-md border">
                  <div className="divide-y">
                    {filteredNotifications.map((n) => {
                      const Icon = icons[n.type] || Bell;
                      const isProcessing = processingIds.has(n.id);

                      return (
                        <Card
                          key={n.id}
                          className={`border-0 rounded-none px-4 py-5 flex items-start gap-4 hover:bg-accent/40 transition ${!n.read ? "bg-accent/20" : ""
                            } ${isProcessing ? "opacity-50" : ""}`}
                        >
                          <div className="p-3 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>

                          <div className="flex-1 space-y-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="font-medium truncate">
                                {n.title}
                              </h3>
                              <span
                                className={`w-3 h-3 rounded-full flex-shrink-0 ${priorityColors[n.priority]
                                  }`}
                                title={`Priority: ${n.priority}`}
                              />
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {n.message}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {formatTimeAgo(n.createdAt)}
                            </p>

                            <div className="flex gap-2 mt-2 flex-wrap">
                              {n.link && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (!n.read && n.id) markAsRead(n.id);
                                    window.location.href = n.link!;
                                  }}
                                  disabled={isProcessing || !isServerConfigured}
                                >
                                  View
                                </Button>
                              )}

                              {!n.read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (n.id) markAsRead(n.id);
                                  }}
                                  disabled={isProcessing || !isServerConfigured || !n.id}
                                  title="Mark as read"
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (n.id) deleteNotification(n.id);
                                }}
                                disabled={isProcessing || !isServerConfigured || !n.id}
                                title="Delete notification"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </div>
  );
}
