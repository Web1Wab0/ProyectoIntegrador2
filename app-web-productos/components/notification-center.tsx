"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "../lib/supabase/client";
import { useToast, type ToastType } from "./toast-provider";
import EmptyState from "./empty-state";

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

const notificationStyles: Record<
  ToastType,
  { icon: typeof Info; iconClass: string; bgClass: string }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
    bgClass: "bg-[rgba(16,185,129,0.12)]",
  },
  info: {
    icon: Info,
    iconClass: "text-[var(--secondary)]",
    bgClass: "bg-[rgba(0,100,122,0.12)]",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    bgClass: "bg-[rgba(245,158,11,0.14)]",
  },
  error: {
    icon: XCircle,
    iconClass: "text-[var(--danger)]",
    bgClass: "bg-[rgba(220,38,38,0.12)]",
  },
};

export default function NotificationCenter() {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelTitleId = useId();
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

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
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
        aria-controls={panelTitleId}
        aria-expanded={open}
        title="Notificaciones"
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="motion-pop surface-popover absolute right-0 z-[10020] mt-3 hidden w-[390px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl sm:block">
            <NotificationPanel
              titleId={panelTitleId}
              loading={loading}
              unreadCount={unreadCount}
              notifications={notifications}
              onClose={() => setOpen(false)}
              onMarkAllAsRead={() => void markAllAsRead()}
              onNotificationClick={(notificationId) => {
                setOpen(false);
                void markAsRead(notificationId);
              }}
            />
          </div>

          <div
            className="fixed inset-0 z-[10030] flex items-end sm:hidden"
            role="presentation"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="motion-fade absolute inset-0 bg-black/40 backdrop-blur-xl"
              aria-label="Cerrar notificaciones"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby={panelTitleId}
              className="motion-sheet surface-popover relative max-h-[calc(100dvh-5rem)] w-full overflow-hidden rounded-t-[22px] border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-elevated)]"
            >
              <div className="pt-3">
                <div className="mx-auto h-1.5 w-12 rounded-full bg-[var(--border)]" />
              </div>
              <NotificationPanel
                titleId={panelTitleId}
                mobile
                loading={loading}
                unreadCount={unreadCount}
                notifications={notifications}
                onClose={() => setOpen(false)}
                onMarkAllAsRead={() => void markAllAsRead()}
                onNotificationClick={(notificationId) => {
                  setOpen(false);
                  void markAsRead(notificationId);
                }}
              />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function NotificationPanel({
  titleId,
  mobile = false,
  loading,
  unreadCount,
  notifications,
  onClose,
  onMarkAllAsRead,
  onNotificationClick,
}: {
  titleId: string;
  mobile?: boolean;
  loading: boolean;
  unreadCount: number;
  notifications: NotificationRow[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onNotificationClick: (notificationId: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
        <div className="min-w-0">
          <p
            id={titleId}
            className="truncate text-base font-semibold text-[var(--on-surface)]"
          >
            Notificaciones
          </p>
          <p className="text-xs text-muted">
            {unreadCount === 0 ? "Todo está al día" : `${unreadCount} sin leer`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className={`btn-soft min-h-10 px-3 py-2 text-xs ${
                mobile ? "w-auto" : ""
              }`}
              title="Marcar todas como leídas"
              aria-label="Marcar todas como leídas"
            >
              <CheckCheck size={17} />
              <span className={mobile ? "inline" : "sr-only"}>Leídas</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="icon-button border border-[var(--border)] bg-[var(--surface-high)]"
            aria-label="Cerrar notificaciones"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div
        className={
          mobile
            ? "scrollbar-none max-h-[calc(100dvh-13rem)] overflow-y-auto overscroll-contain px-3 py-3"
            : "scrollbar-none max-h-[min(480px,70vh)] overflow-y-auto overscroll-contain p-2"
        }
      >
        {loading ? (
          <div className="space-y-3 p-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Sin notificaciones"
            description="Aquí aparecerán reservas, cambios de estado y avisos importantes."
            className="border-0 bg-transparent px-4 py-9 shadow-none"
          />
        ) : (
          <div className="grid gap-2">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => onNotificationClick(notification.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: NotificationRow;
  onClick: () => void;
}) {
  const style = notificationStyles[notification.type] ?? notificationStyles.info;
  const Icon = style.icon;

  return (
    <Link
      href={notification.href}
      onClick={onClick}
      className={`interactive-lift block rounded-xl border px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
        notification.read_at
          ? "border-transparent bg-[var(--surface-lowest)]"
          : "border-[rgba(121,0,243,0.2)] bg-[rgba(121,0,243,0.055)]"
      }`}
    >
      <div className="flex min-w-0 gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.bgClass}`}
        >
          <Icon size={18} className={style.iconClass} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="min-w-0 break-words text-sm font-semibold leading-5 text-[var(--on-surface)]">
              {notification.title}
            </p>
            {!notification.read_at ? (
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
            ) : null}
          </div>
          <p className="mt-1 line-clamp-3 break-words text-sm leading-5 text-muted">
            {notification.message}
          </p>
          <p className="mt-2 text-xs text-soft">
            {formatNotificationDate(notification.created_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
