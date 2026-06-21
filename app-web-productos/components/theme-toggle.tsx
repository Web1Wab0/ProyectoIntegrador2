"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "./theme-provider";

const options: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Laptop },
];

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();

  if (compact) {
    const currentIndex = options.findIndex((item) => item.value === preference);
    const next = options[(currentIndex + 1) % options.length];
    const Icon = next.icon;

    return (
      <button
        type="button"
        onClick={() => setPreference(next.value)}
        className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
      >
        <Icon size={17} />
        Tema: {options.find((item) => item.value === preference)?.label}
      </button>
    );
  }

  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-high)] p-1">
      {options.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreference(option.value)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
              active
                ? "bg-[var(--surface-lowest)] text-[var(--primary)] shadow-sm"
                : "text-muted hover:text-[var(--on-surface)]"
            }`}
          >
            <Icon size={16} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
