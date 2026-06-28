"use client";

import { Check, Laptop, Moon, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useTheme,
  type ThemePreference,
} from "./theme-provider";

const options: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: "light",
    label: "Claro",
    description: "Fondo luminoso",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Oscuro",
    description: "Menos brillo",
    icon: Moon,
  },
  {
    value: "system",
    label: "Sistema",
    description: "Según tu dispositivo",
    icon: Laptop,
  },
];

export default function PublicThemeMenu() {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const firstOptionRef = useRef<HTMLButtonElement | null>(null);
  const current =
    options.find((option) => option.value === preference) ?? options[2];
  const CurrentIcon = current.icon;

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => firstOptionRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectTheme(nextPreference: ThemePreference) {
    setPreference(nextPreference);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="icon-button border border-[var(--border)] bg-[var(--surface-lowest)] shadow-sm"
        aria-label={`Tema: ${current.label}. Cambiar tema`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Tema: ${current.label}`}
      >
        <CurrentIcon size={19} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Seleccionar tema"
          className="motion-pop surface-popover absolute right-0 z-[10020] mt-3 w-64 rounded-2xl p-2"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-[var(--on-surface)]">
                Apariencia
              </p>
              <p className="text-xs text-muted">Elige cómo ver AhorraPe</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="icon-button h-8 w-8"
              aria-label="Cerrar selector de tema"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-1 grid gap-1">
            {options.map((option, index) => {
              const Icon = option.icon;
              const active = option.value === preference;

              return (
                <button
                  key={option.value}
                  ref={index === 0 ? firstOptionRef : undefined}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => selectTheme(option.value)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                    active
                      ? "bg-[rgba(121,0,243,0.09)] text-[var(--primary)]"
                      : "text-[var(--on-surface)] hover:bg-[var(--surface-high)]"
                  }`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {option.label}
                    </span>
                    <span className="block text-xs text-muted">
                      {option.description}
                    </span>
                  </span>
                  {active ? <Check size={17} className="shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
