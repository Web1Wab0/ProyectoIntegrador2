"use client";

import { Clock3, Copy } from "lucide-react";
import {
  STORE_DAYS,
  type StoreOpeningHours,
} from "../lib/store-hours";

type Props = {
  value: StoreOpeningHours;
  onChange: (nextValue: StoreOpeningHours) => void;
};

export default function StoreHoursEditor({ value, onChange }: Props) {
  function updateDay(
    dayKey: string,
    updates: Partial<StoreOpeningHours[string]>
  ) {
    onChange({
      ...value,
      [dayKey]: {
        ...value[dayKey],
        ...updates,
      },
    });
  }

  function copyToOpenDays(sourceDayKey: string) {
    const source = value[sourceDayKey];

    onChange(
      Object.fromEntries(
        Object.entries(value).map(([dayKey, dayHours]) => [
          dayKey,
          dayHours.closed
            ? dayHours
            : {
                ...dayHours,
                open: source.open,
                close: source.close,
              },
        ])
      ) as StoreOpeningHours
    );
  }

  return (
    <section className="app-card-soft p-4 sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(121,0,243,0.08)] text-[var(--primary)]">
          <Clock3 size={20} />
        </div>
        <div>
          <h2 className="section-title text-xl">Horario de atención</h2>
          <p className="mt-1 text-sm text-muted">
            Define cuándo pueden recoger sus reservas tus clientes.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        {STORE_DAYS.map((day) => {
          const dayHours = value[day.key];
          const isOpen = !dayHours.closed;

          return (
            <div
              key={day.key}
              className={`border-b border-[var(--border)] p-3 last:border-b-0 sm:p-4 ${
                isOpen ? "bg-white" : "bg-[var(--surface-high)]"
              }`}
            >
              <div className="grid gap-3 md:grid-cols-[130px_110px_minmax(0,1fr)_minmax(0,1fr)_44px] md:items-end">
                <div className="flex items-center justify-between gap-3 md:block">
                  <span className="font-semibold text-[var(--on-surface)]">
                    {day.label}
                  </span>
                  <span
                    className={`text-xs font-semibold md:mt-1 md:block ${
                      isOpen ? "text-[var(--secondary)]" : "text-muted"
                    }`}
                  >
                    {isOpen ? "Abierto" : "Cerrado"}
                  </span>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isOpen}
                  onClick={() =>
                    updateDay(day.key, { closed: isOpen })
                  }
                  className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  <span>{isOpen ? "Abierto" : "Cerrado"}</span>
                  <span
                    className={`relative h-5 w-9 rounded-full transition ${
                      isOpen ? "bg-[var(--primary)]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                        isOpen ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>

                <div className={isOpen ? "" : "opacity-45"}>
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    Apertura
                  </label>
                  <input
                    type="time"
                    value={dayHours.open}
                    disabled={!isOpen}
                    onChange={(event) =>
                      updateDay(day.key, { open: event.target.value })
                    }
                    className="app-input disabled:cursor-not-allowed"
                  />
                </div>

                <div className={isOpen ? "" : "opacity-45"}>
                  <label className="mb-1 block text-xs font-semibold text-muted">
                    Cierre
                  </label>
                  <input
                    type="time"
                    value={dayHours.close}
                    disabled={!isOpen}
                    onChange={(event) =>
                      updateDay(day.key, { close: event.target.value })
                    }
                    className="app-input disabled:cursor-not-allowed"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => copyToOpenDays(day.key)}
                  disabled={!isOpen}
                  className="icon-button border border-[var(--border)] disabled:cursor-not-allowed disabled:opacity-35"
                  title="Aplicar este horario a todos los días abiertos"
                  aria-label={`Aplicar horario de ${day.label} a todos los días abiertos`}
                >
                  <Copy size={17} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted">
        El botón de copiar aplica la apertura y el cierre de esa fila a todos
        los días que estén marcados como abiertos.
      </p>
    </section>
  );
}
