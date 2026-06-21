"use client";

import Link from "next/link";
import { Bell, CheckCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { useToast, type ToastType } from "./toast-provider";

type NotificationRow = {
  id: string;
  user_id: string;
  reservation_id: string;
  event_key: string;
  type: ToastType;
  title: string;
  message: string;
  href: string;
  viewed_at: string | null;
  read_at: string | null;
  created_at: string;
};

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function NotificationCenter() {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const markViewed = useCallback(
    async (notificationId: string) => {
      const viewedAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId && !item.viewed_at
            ? { ...item, viewed_at: viewedAt }
            : item
        )
      );
      await supabase
        .from("notifications")
        .update({ viewed_at: viewedAt })
        .eq("id", notificationId);
    },
    [supabase]
  );

  const announceNotification = useCallback(
    (notification: NotificationRow) => {
      showToast({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        href: notification.href,
        onDismiss: () => {
          void markViewed(notification.id);
        },
      });
    },
    [markViewed, showToast]
  );

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUserId(data.session?.user.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user.id ?? null);
      if (!session?.user) {
        setNotifications([]);
        setOpen(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    window.setTimeout(async () => {
      if (mounted) setLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, user_id, reservation_id, event_key, type, title, message, href, viewed_at, read_at, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!mounted) return;
      setLoading(false);

      if (error) {
        // The frontend remains usable before the notification SQL is applied.
        if (error.code !== "42P01" && error.code !== "PGRST205") {
          console.error("No se pudieron cargar las notificaciones.", error);
        }
        return;
      }

      const rows = (data ?? []) as NotificationRow[];
      setNotifications(rows);
      rows
        .filter((item) => !item.viewed_at)
        .slice(0, 3)
        .reverse()
        .forEach(announceNotification);
    }, 0);

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as NotificationRow;
          setNotifications((current) => [
            notification,
            ...current.filter((item) => item.id !== notification.id),
          ]);
          announceNotification(notification);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [announceNotification, supabase, userId]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  async function markAsRead(notificationId: string) {
    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId
          ? { ...item, read_at: now, viewed_at: item.viewed_at ?? now }
          : item
      )
    );
    await supabase
      .from("notifications")
      .update({ read_at: now, viewed_at: now })
      .eq("id", notificationId);
  }

  async function markAllAsRead() {
    if (!userId || unreadCount === 0) return;

    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        read_at: item.read_at ?? now,
        viewed_at: item.viewed_at ?? now,
      }))
    );
    await supabase
      .from("notifications")
      .update({ read_at: now, viewed_at: now })
      .eq("user_id", userId)
      .is("read_at", null);
  }

  if (!userId) return null;

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="icon-button relative"
        aria-label={
          unreadCount > 0
            ? `Notificaciones, ${unreadCount} sin leer`
            : "Notificaciones"
        }
        aria-expanded={open}
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-[10020] mt-3 w-[calc(100vw-2rem)] max-w-[390px] overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_18px_55px_rgba(44,47,48,0.18)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="font-semibold text-[var(--on-surface)]">
                Notificaciones
              </p>
              <p className="text-xs text-muted">
                {unreadCount === 0
                  ? "Todo está al día"
                  : `${unreadCount} sin leer`}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllAsRead()}
                  className="icon-button"
                  title="Marcar todas como leídas"
                  aria-label="Marcar todas como leídas"
                >
                  <CheckCheck size={18} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="icon-button"
                aria-label="Cerrar notificaciones"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-[min(480px,70vh)] overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="skeleton h-20 rounded-lg" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell
                  size={28}
                  className="mx-auto text-[var(--muted-soft)]"
                />
                <p className="mt-3 text-sm font-medium">
                  No tienes notificaciones todavía.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.href}
                  onClick={() => {
                    setOpen(false);
                    void markAsRead(notification.id);
                  }}
                  className={`block border-b border-[var(--border)] px-4 py-3 transition last:border-b-0 hover:bg-[var(--surface-high)] ${
                    notification.read_at
                      ? "bg-white"
                      : "bg-[rgba(121,0,243,0.045)]"
                  }`}
                >
                  <div className="flex gap-3">
                    <span
                      className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                        notification.read_at
                          ? "bg-transparent"
                          : "bg-[var(--primary)]"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--on-surface)]">
                        {notification.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">
                        {notification.message}
                      </p>
                      <p className="mt-2 text-xs text-soft">
                        {formatNotificationDate(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
