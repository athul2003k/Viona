"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useOrgStore";

import {
  Card,
  CardHeader,
  CardContent,
  CardTitle
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  Bell,
  BellRing,
  Check,
  Trash2,
  Settings,
  X,
  Mail,
  Package,
  Calendar,
  Shield
} from "lucide-react";

// ---------------------------------------------
// TYPES
// ---------------------------------------------

interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: "message" | "order" | "reminder" | "system" | "default";
  priority: "LOW" | "MEDIUM" | "HIGH";
  link?: string;
}

// ---------------------------------------------
// CONSTANTS & HELPERS
// ---------------------------------------------

const MAX_STORED_NOTIFICATIONS = 100;

const getStorageKey = (userId: string) => `app_notifications_${userId}`;

/** Icons */
const getNotificationIcon = (type: Notification["type"]) => {
  const iconProps = { className: "h-4 w-4" };
  switch (type) {
    case "message": return <Mail {...iconProps} />;
    case "order": return <Package {...iconProps} />;
    case "reminder": return <Calendar {...iconProps} />;
    case "system": return <Shield {...iconProps} />;
    default: return <Bell {...iconProps} />;
  }
};

/** Priority color */
const getPriorityColor = (priority: Notification["priority"]) => {
  switch (priority) {
    case "HIGH": return "bg-red-500";
    case "MEDIUM": return "bg-blue-500";
    default: return "bg-gray-400";
  }
};

/** Time formatter */
const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  });
};

/** Load cached notifications (per user) */
const loadNotificationsFromStorage = (userId: string): Notification[] => {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_STORED_NOTIFICATIONS) : [];
  } catch (err) {
    console.error("Failed to load notifications:", err);
    return [];
  }
};

/** Store up to 100 notifications */
const saveNotificationsToStorage = (userId: string, notifications: Notification[]) => {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(
      getStorageKey(userId),
      JSON.stringify(notifications.slice(0, MAX_STORED_NOTIFICATIONS))
    );
  } catch (err) {
    console.error("Failed to save notifications:", err);
  }
};

// ---------------------------------------------
// COMPONENT
// ---------------------------------------------

export function NotificationDropdown() {
  const router = useRouter();
  const user = useCurrentUser();
  const userId = user?.id || "";

  // ---------------------------------------------
  // STATE
  // ---------------------------------------------

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeout = useRef<NodeJS.Timeout | null>(null);
  const retryAttempt = useRef(0);

  // ---------------------------------------------
  // SORTED NOTIFICATIONS
  // ---------------------------------------------

  const unreadCount = notifications.filter((n) => !n.read).length;

  const sortedNotifications = useMemo(() => {
    const priorityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return [...notifications].sort((a, b) => {
      const diff = priorityRank[b.priority] - priorityRank[a.priority];
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notifications]);

  // ---------------------------------------------
  // INITIAL LOAD (localStorage only)
  // ---------------------------------------------

  useEffect(() => {
    if (!userId) return;
    const stored = loadNotificationsFromStorage(userId);
    setNotifications(stored);
  }, [userId]);

  // ---------------------------------------------
  // SYNC TO LOCAL STORAGE
  // ---------------------------------------------

  useEffect(() => {
    if (!userId) return;
    saveNotificationsToStorage(userId, notifications);
  }, [notifications, userId]);

  // ---------------------------------------------
  // CLOSE DROPDOWN WHEN CLICK OUTSIDE
  // ---------------------------------------------

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // ---------------------------------------------
  // SSE WITH PRODUCTION READY RECONNECT
  // ---------------------------------------------

  useEffect(() => {
    if (!userId) return;

    const serverUrl = process.env.NEXT_PUBLIC_NOTIFICATION_SERVER_URL;
    if (!serverUrl) return console.error("Missing notification server URL.");

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const url = `${serverUrl}/notifications/stream?userId=${userId}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        retryAttempt.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);

          // enforce type safety
          const priority: Notification["priority"] =
            ["LOW", "MEDIUM", "HIGH"].includes(raw.priority)
              ? raw.priority
              : "MEDIUM";

          const type: Notification["type"] =
            ["message", "order", "reminder", "system", "default"].includes(raw.type)
              ? raw.type
              : "default";

          const notif: Notification = {
            id: raw.id,
            title: raw.title,
            message: raw.message,
            createdAt: raw.createdAt ?? new Date().toISOString(),
            read: false,
            priority,
            type,
            link: raw.link
          };

          // flood protection (batching)
          setNotifications((prev) => {
            const filtered = prev.filter((n) => n.id !== notif.id);
            return [notif, ...filtered];
          });
        } catch (err) {
          console.error("Failed to parse SSE message:", err);
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        retryAttempt.current += 1;
        const delay = Math.min(30000, 1000 * retryAttempt.current);

        if (retryTimeout.current) clearTimeout(retryTimeout.current);

        retryTimeout.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (retryTimeout.current) clearTimeout(retryTimeout.current);
    };
  }, [userId]);

  // ---------------------------------------------
  // UI ACTIONS (Only local updates, backend untouched)
  // ---------------------------------------------

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAsReadHandler = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    markAsRead(id);
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
    if (userId) localStorage.removeItem(getStorageKey(userId));
  };

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n.id);
    setIsOpen(false);
    if (n.link) router.push(n.link);
  };

  // ---------------------------------------------
  // RENDER
  // ---------------------------------------------

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen((p) => !p)}
        className="relative hover:bg-accent"
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5 text-primary animate-pulse" />
        ) : (
          <Bell className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 bg-red-600 text-white px-1.5 py-0 text-[10px]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <Card className="absolute top-full right-0 mt-2 w-[400px] rounded-lg shadow-xl border bg-background z-[100]">
          <CardHeader className="border-b py-4 px-5 flex justify-between">
            <div className="flex justify-between">
              <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
              )}
              <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setNotifications((p) => p.map((n) => ({ ...n, read: true })))}
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            </div>
            
          </CardHeader>

          <CardContent className="p-0 max-h-[500px]">
            <ScrollArea className="h-[500px]">
              {sortedNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {sortedNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-4 group cursor-pointer transition ${
                        !n.read ? "bg-accent/30" : ""
                      } hover:bg-accent/50`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            n.read ? "bg-accent/50" : "bg-primary/10"
                          }`}
                        >
                          {getNotificationIcon(n.type)}
                        </div>

                        <div className="flex-1">
                          <div className="flex justify-between">
                            <h4
                              className={`text-sm line-clamp-1 ${
                                !n.read ? "font-semibold" : ""
                              }`}
                            >
                              {n.title}
                            </h4>
                            <span
                              className={`w-2 h-2 rounded-full ${getPriorityColor(n.priority)}`}
                            />
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {n.message}
                          </p>

                          <div className="flex justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(n.createdAt)}
                            </span>

                            <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                              {!n.read && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => markAsReadHandler(n.id, e)}
                                >
                                  <Check className="w-3 h-3 text-green-600" />
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500"
                                onClick={(e) => deleteNotification(n.id, e)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>

          <Separator />

          <div className="p-2">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md text-sm"
            >
              <Bell className="h-4 w-4" /> View All Notifications
            </Link>

            <Link
              href="/settings/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md text-sm"
            >
              <Settings className="h-4 w-4" /> Notification Settings
            </Link>

            {notifications.length > 0 && (
              <>
                <Separator className="my-2" />
                <button
                  onClick={clearAll}
                  className="flex items-center w-full gap-2 px-3 py-2 hover:bg-accent text-sm text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear All
                </button>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
