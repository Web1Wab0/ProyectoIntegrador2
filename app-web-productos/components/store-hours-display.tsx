"use client";

import { ChevronDown, Clock3 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import {
  getCurrentLimaDayKey,
  getStoreOpenStatus,
  STORE_DAYS,
  type StoreOpeningHours,
} from "../lib/store-hours";

type Props = {
  hours: StoreOpeningHours;
  compact?: boolean;
  className?: string;
};

export default function StoreHoursDisplay({
  hours,
  compact = false,
  className = "",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const shouldReduceMotion = useReducedMotion() === true;
  const status = useMemo(() => getStoreOpenStatus(hours), [hours]);
  const currentDayKey = useMemo(() => getCurrentLimaDayKey(), []);

  function stopCardNavigation(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  return (
    <div
      className={`${compact ? "" : "rounded-xl border border-[var(--border)] bg-[var(--surface-high)] p-4"} ${className}`}
      onClick={stopCardNavigation}
      onKeyDown={stopCardNavigation}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            status.isOpen
              ? "bg-cyan-50 text-[var(--secondary)]"
              : "bg-slate-100 text-[var(--muted)]"
          }`}
        >
          <Clock3 size={18} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`text-sm font-semibold ${
                status.isOpen ? "text-[var(--secondary)]" : "text-[var(--on-surface)]"
              }`}
            >
              {status.label}
            </span>
            <span className="text-sm text-muted">{status.detail}</span>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-expanded={expanded}
          >
            {expanded ? "Ocultar horario" : "Ver horario"}
            <ChevronDown
              size={14}
              className={`transition ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            className={`${compact ? "mt-3" : "mt-4"} overflow-hidden rounded-lg border border-[var(--border)] bg-white`}
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 36, mass: 0.8 }}
          >
            {STORE_DAYS.map((day) => {
              const dayHours = hours[day.key];
              const isToday = day.key === currentDayKey;

              return (
                <div
                  key={day.key}
                  className={`flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2.5 text-sm last:border-b-0 ${
                    isToday ? "bg-[rgba(121,0,243,0.055)]" : ""
                  }`}
                >
                  <span
                    className={
                      isToday
                        ? "font-semibold text-[var(--primary)]"
                        : "text-[var(--on-surface)]"
                    }
                  >
                    {day.label}
                    {isToday ? " · Hoy" : ""}
                  </span>
                  <span
                    className={
                      !dayHours || dayHours.closed
                        ? "font-medium text-[var(--muted-soft)]"
                        : "font-medium text-[var(--on-surface)]"
                    }
                  >
                    {!dayHours || dayHours.closed
                      ? "Cerrado"
                      : `${dayHours.open} – ${dayHours.close}`}
                  </span>
                </div>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
