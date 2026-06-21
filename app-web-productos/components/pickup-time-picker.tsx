"use client";

import { Clock3 } from "lucide-react";
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
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Clock3 size={17} className="text-[var(--primary)]" />
        <span className="text-sm font-semibold">Hora disponible</span>
      </div>

      {slots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-high)] px-4 py-5 text-center">
          <Clock3
            size={22}
            className="mx-auto text-[var(--muted-soft)]"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm font-semibold text-[var(--on-surface)]">
            {isClosed ? "La tienda está cerrada ese día" : "Ya no quedan horas disponibles"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Elige otra fecha para continuar con tu reserva.
          </p>
        </div>
      ) : (
        <div
          className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-high)] p-2 sm:grid-cols-3"
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
                className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
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
    </div>
  );
}
