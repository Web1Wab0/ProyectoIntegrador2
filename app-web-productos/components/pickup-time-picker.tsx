"use client";

import { ChevronDown, Clock3 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { PickupSlot } from "../lib/store-hours";

type Props = {
  slots: PickupSlot[];
  value: string;
  onChange: (value: string) => void;
  isClosed: boolean;
};

export default function PickupTimePicker({
  slots,
  value,
  onChange,
  isClosed,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const shouldReduceMotion = useReducedMotion() === true;

  return (
    <div className="min-w-0 max-w-full rounded-xl border border-[var(--border)] bg-[var(--surface-lowest)]">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Clock3 size={17} className="text-[var(--primary)]" />
          <span className="text-sm font-semibold">Hora disponible</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted">
          {value || `${slots.length} opciones`}
          <ChevronDown
            size={16}
            className={`transition ${expanded ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            className="overflow-hidden px-3 pb-3"
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 36, mass: 0.8 }}
          >
            {slots.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-high)] px-4 py-5 text-center">
                <Clock3
                  size={22}
                  className="mx-auto text-[var(--muted-soft)]"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
                  {isClosed
                    ? "La tienda está cerrada ese día"
                    : "Ya no quedan horas disponibles"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Elige otra fecha para continuar con tu reserva.
                </p>
              </div>
            ) : (
              <div
                className="scrollbar-none grid min-w-0 max-w-full max-h-52 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-high)] p-2 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Horas disponibles para recoger"
              >
                {slots.map((slot) => {
                  const selected = slot.value === value;

                  return (
                    <button
                      key={slot.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange(slot.value)}
                      className={`min-h-10 min-w-0 rounded-lg border px-3 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                        selected
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm"
                          : "border-[var(--border)] bg-white text-[var(--on-surface)] hover:border-[rgba(121,0,243,0.35)] hover:bg-[rgba(121,0,243,0.04)]"
                      }`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
