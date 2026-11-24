"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";

type FanNotification = {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationResponse = {
  notifications: FanNotification[];
  unreadCount: number;
  isGuest: boolean;
};

function safeNotificationLink(link: string | null) {
  if (!link) return null;

  // Only allow internal SportyFanz paths.
  if (!link.startsWith("/") || link.startsWith("//")) {
    return null;
  }

  if (link.includes("\\") || /[\u0000-\u001f]/.test(link)) {
    return null;
  }

  return link;
}

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<FanNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch("/api/notifications", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load notifications.");
      }

      const data =
        (await response.json()) as NotificationResponse;

      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      setIsGuest(Boolean(data.isGuest));
    } catch {
      setError("Unable to load notifications. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;

    void loadNotifications();

    function handleOutsideClick(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, loadNotifications]);

  async function markAsRead(id: number) {
    if (busy) return;

    setBusy(true);

    try {
      const response = await apiFetch(
        `/api/notifications/${id}`,
        { method: "PATCH" }
      );

      if (!response.ok) {
        throw new Error("Unable to update notification.");
      }

      setNotifications((items) =>
        items.map((item) =>
          item.id === id ? { ...item, isRead: true } : item
        )
      );

      await loadNotifications();
    } catch {
      setError("Unable to mark notification as read.");
    } finally {
      setBusy(false);
    }
  }

  async function markAllAsRead() {
    if (busy || unreadCount === 0) return;

    setBusy(true);

    try {
      const response = await apiFetch(
        "/api/notifications/read-all",
        { method: "PATCH" }
      );

      if (!response.ok) {
        throw new Error("Unable to update notifications.");
      }

      await loadNotifications();
    } catch {
      setError("Unable to mark all notifications as read.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notification-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="sf-icon-button notification-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={18} />

        {unreadCount > 0 && (
          <span className="notification-dot" />
        )}
      </button>

      {open && (
        <div
          className="notification-dropdown"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="notification-header">
            <strong>Notifications</strong>

            {unreadCount > 0 && !isGuest && (
              <button
                type="button"
                className="notification-mark-all"
                disabled={busy}
                onClick={() => void markAllAsRead()}
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {unreadCount > 0 && (
            <p className="notification-unread-count">
              {unreadCount} unread
            </p>
          )}

          {loading && notifications.length === 0 && (
            <p className="notification-empty">
              Loading notifications...
            </p>
          )}

          {error && (
            <div className="notification-error">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void loadNotifications()}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && isGuest && (
            <p className="notification-empty">
              Sign in to receive personal notifications.
            </p>
          )}

          {!loading &&
            !error &&
            !isGuest &&
            notifications.length === 0 && (
              <p className="notification-empty">
                You have no notifications yet.
              </p>
            )}

          {!isGuest && notifications.length > 0 && (
            <div className="notification-list">
              {notifications.map((item) => {
                const href = safeNotificationLink(item.link);

                return (
                  <div
                    key={item.id}
                    className={`notification-row ${
                      item.isRead ? "is-read" : "is-unread"
                    }`}
                  >
                    <div className="notification-content">
                      <strong>{item.title}</strong>

                      {item.message && <p>{item.message}</p>}

                      <small>
                        {new Date(item.createdAt).toLocaleString()}
                      </small>

                      {href && (
                        <Link
                          href={href}
                          onClick={() => {
                            setOpen(false);

                            if (!item.isRead) {
                              void markAsRead(item.id);
                            }
                          }}
                        >
                          View details
                        </Link>
                      )}
                    </div>

                    {!item.isRead && (
                      <button
                        type="button"
                        className="notification-read-button"
                        disabled={busy}
                        onClick={() => void markAsRead(item.id)}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
