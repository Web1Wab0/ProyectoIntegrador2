"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastType = "success" | "info" | "warning" | "error";

type ToastInput = {
  type: ToastType;
  message: string;
  title?: string;
  href?: string;
  duration?: number;
  onDismiss?: () => void;
};

type ToastItem = ToastInput & {
  id: string;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  warning: 7000,
  error: 8000,
};

const toastStyles: Record<
  ToastType,
  {
    icon: typeof Info;
    iconClass: string;
    borderClass: string;
    progressClass: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
    borderClass: "border-emerald-200",
    progressClass: "bg-emerald-500",
  },
  info: {
    icon: Info,
    iconClass: "text-[var(--secondary)]",
    borderClass: "border-cyan-200",
    progressClass: "bg-[var(--primary)]",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    borderClass: "border-amber-200",
    progressClass: "bg-amber-500",
  },
  error: {
    icon: XCircle,
    iconClass: "text-[var(--danger)]",
    borderClass: "border-red-200",
    progressClass: "bg-[var(--danger)]",
  },
};

function newToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef(new Map<string, number>());
  const dismissCallbacksRef = useRef(new Map<string, () => void>());
  const recentToastRef = useRef<{ signature: string; createdAt: number } | null>(
    null
  );

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);

    const onDismiss = dismissCallbacksRef.current.get(id);
    dismissCallbacksRef.current.delete(id);
    onDismiss?.();

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (input: ToastInput) => {
      const signature = `${input.type}:${input.title ?? ""}:${input.message}:${
        input.href ?? ""
      }`;
      const now = Date.now();

      if (
        recentToastRef.current?.signature === signature &&
        now - recentToastRef.current.createdAt < 750
      ) {
        return "";
      }

      recentToastRef.current = { signature, createdAt: now };
      const id = newToastId();
      const toast: ToastItem = { ...input, id };

      if (input.onDismiss) {
        dismissCallbacksRef.current.set(id, input.onDismiss);
      }

      setToasts((current) => [...current.slice(-3), toast]);

      const duration = input.duration ?? DEFAULT_DURATIONS[input.type];
      const timer = window.setTimeout(() => dismissToast(id), duration);
      timersRef.current.set(id, timer);

      return id;
    },
    [dismissToast]
  );

  const contextValue = useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-4 top-20 z-[10050] flex flex-col items-end gap-3 sm:left-auto sm:right-5 sm:w-[390px]"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const style = toastStyles[toast.type];
          const Icon = style.icon;
          const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type];
          const content = (
            <>
              <Icon
                size={21}
                className={`mt-0.5 shrink-0 ${style.iconClass}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                {toast.title ? (
                  <p className="font-semibold text-[var(--on-surface)]">
                    {toast.title}
                  </p>
                ) : null}
                <p className="break-words text-sm leading-5 text-[var(--muted)]">
                  {toast.message}
                </p>
                {toast.href ? (
                  <span className="mt-2 inline-block text-sm font-semibold text-[var(--primary)]">
                    Ver detalle
                  </span>
                ) : null}
                <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-[var(--surface-high)]">
                  <div
                    className={`toast-progress h-full rounded-full ${style.progressClass}`}
                    style={{ animationDuration: `${duration}ms` }}
                  />
                </div>
              </div>
            </>
          );

          return (
            <div
              key={toast.id}
              role={toast.type === "error" ? "alert" : "status"}
              className={`toast-enter surface-popover pointer-events-auto flex w-full items-start gap-3 rounded-2xl p-4 ${style.borderClass}`}
            >
              {toast.href ? (
                <Link
                  href={toast.href}
                  onClick={() => dismissToast(toast.id)}
                  className="flex min-w-0 flex-1 items-start gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {content}
                </div>
              )}

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="icon-button -mr-1 -mt-1"
                aria-label="Cerrar alerta"
              >
                <X size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast debe usarse dentro de ToastProvider.");
  }

  return context;
}
