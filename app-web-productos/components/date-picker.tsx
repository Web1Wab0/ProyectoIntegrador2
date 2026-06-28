"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  today?: string;
  align?: "left" | "right";
  isDateDisabled?: (value: string) => boolean;
  getDateHint?: (value: string) => string | null;
  className?: string;
};

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

function toDateValue(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function toUtcDate(value: string) {
  const parsed = parseDateValue(value);
  if (!parsed) return null;
  return new Date(Date.UTC(parsed.year, parsed.month, parsed.day));
}

function addMonths(value: string, months: number) {
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  return toDateValue(parsed.year, parsed.month + months, 1);
}

function getMonthGrid(monthValue: string) {
  const parsed = parseDateValue(monthValue);
  if (!parsed) return [];

  const first = new Date(Date.UTC(parsed.year, parsed.month, 1));
  const mondayIndex = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - mondayIndex);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);

    return {
      value: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      inCurrentMonth: date.getUTCMonth() === parsed.month,
    };
  });
}

function formatDateLabel(value: string) {
  const date = toUtcDate(value);
  if (!date) return "Selecciona una fecha";
  return DATE_FORMATTER.format(date).replace(".", "");
}

function formatMonthLabel(value: string) {
  const date = toUtcDate(value);
  if (!date) return "";
  return MONTH_FORMATTER.format(date);
}

function getInitialMonth(value: string, min?: string) {
  const base = parseDateValue(value) ? value : min;
  if (base && parseDateValue(base)) {
    const parsed = parseDateValue(base)!;
    return toDateValue(parsed.year, parsed.month, 1);
  }

  const now = new Date();
  return toDateValue(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

export default function DatePicker({
  value,
  onChange,
  label,
  min,
  max,
  disabled = false,
  today,
  align = "left",
  isDateDisabled,
  getDateHint,
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => getInitialMonth(value, min));
  const [popoverStyle, setPopoverStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion() === true;
  const grid = useMemo(() => getMonthGrid(month), [month]);
  const monthLabel = useMemo(() => formatMonthLabel(month), [month]);

  const updatePopoverPosition = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.min(336, window.innerWidth - 32);
    const estimatedHeight = 390;
    const preferredTop = rect.bottom + 10;
    const top =
      preferredTop + estimatedHeight > window.innerHeight
        ? Math.max(16, rect.top - estimatedHeight - 10)
        : preferredTop;
    const rawLeft = align === "right" ? rect.right - width : rect.left;
    const left = Math.min(Math.max(16, rawLeft), window.innerWidth - width - 16);

    setPopoverStyle({ top, left, width });
  }, [align]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  const canGoPrevious =
    !min || addMonths(month, -1).slice(0, 7) >= min.slice(0, 7);
  const canGoNext = !max || addMonths(month, 1).slice(0, 7) <= max.slice(0, 7);

  function isDisabled(dateValue: string) {
    if (min && dateValue < min) return true;
    if (max && dateValue > max) return true;
    return isDateDisabled?.(dateValue) === true;
  }

  return (
    <div ref={wrapperRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          if (!open) {
            setMonth(getInitialMonth(value, min));
            updatePopoverPosition();
          }
          setOpen((current) => !current);
        }}
        disabled={disabled}
        className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-lowest)] px-4 py-3 text-left shadow-sm outline-none transition hover:border-[rgba(121,0,243,0.35)] hover:shadow-[0_10px_26px_var(--shadow)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(121,0,243,0.09)] text-[var(--primary)]">
            <CalendarDays size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
              {label}
            </span>
            <span className="block truncate text-sm font-semibold">
              {formatDateLabel(value)}
            </span>
          </span>
        </span>
      </button>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open && popoverStyle ? (
          <motion.div
            ref={popoverRef}
            className="surface-popover fixed z-[10060] overflow-hidden rounded-2xl p-3"
            style={{
              top: popoverStyle.top,
              left: popoverStyle.left,
              width: popoverStyle.width,
            }}
            initial={
              shouldReduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              shouldReduceMotion
                ? undefined
                : { opacity: 0, y: -8, scale: 0.98 }
            }
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.75 }}
          >
            <div className="flex items-center justify-between gap-3 px-1 pb-3">
              <button
                type="button"
                onClick={() => canGoPrevious && setMonth((current) => addMonths(current, -1))}
                disabled={!canGoPrevious}
                className="icon-button"
                aria-label="Mes anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <p className="text-sm font-bold capitalize">{monthLabel}</p>
              <button
                type="button"
                onClick={() => canGoNext && setMonth((current) => addMonths(current, 1))}
                disabled={!canGoNext}
                className="icon-button"
                aria-label="Mes siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 px-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
              {WEEK_DAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
              {grid.map((day) => {
                const selected = day.value === value;
                const isToday = today ? day.value === today : false;
                const dayDisabled = isDisabled(day.value);
                const hint = getDateHint?.(day.value);

                return (
                  <button
                    key={day.value}
                    type="button"
                    disabled={dayDisabled}
                    title={hint ?? undefined}
                    onClick={() => {
                      onChange(day.value);
                      setOpen(false);
                    }}
                    className={`relative flex h-10 min-w-0 items-center justify-center rounded-xl text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                      selected
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : dayDisabled
                        ? "cursor-not-allowed bg-[var(--surface-high)] text-[var(--muted-soft)] opacity-45"
                        : day.inCurrentMonth
                        ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] hover:bg-[rgba(121,0,243,0.08)]"
                        : "text-[var(--muted-soft)] hover:bg-[var(--surface-high)]"
                    }`}
                  >
                    {day.day}
                    {isToday && !selected ? (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--primary)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}
