"use client";

import { Minus, Plus } from "lucide-react";

type NumberStepperProps = {
  value: string | number;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  label?: string;
  inputMode?: "numeric" | "decimal";
  className?: string;
  inputClassName?: string;
};

function decimalPlaces(value: number) {
  const [, decimal = ""] = String(value).split(".");
  return decimal.length;
}

function normalizeNumber(value: number, min?: number, max?: number) {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
}

function formatValue(value: number, step: number, precision?: number) {
  const places = precision ?? decimalPlaces(step);
  if (typeof precision === "number") return value.toFixed(places);
  if (places === 0) return String(Math.round(value));
  return value.toFixed(places).replace(/\.?0+$/, "");
}

export default function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  precision,
  disabled = false,
  label,
  inputMode = step < 1 ? "decimal" : "numeric",
  className = "",
  inputClassName = "",
}: NumberStepperProps) {
  const rawValue = String(value ?? "");
  const numericValue = Number(rawValue);
  const hasValidNumber = Number.isFinite(numericValue);
  const safeCurrent = hasValidNumber
    ? normalizeNumber(numericValue, min, max)
    : typeof min === "number"
    ? min
    : 0;
  const canDecrease =
    !disabled && (typeof min !== "number" || safeCurrent - step >= min);
  const canIncrease =
    !disabled && (typeof max !== "number" || safeCurrent + step <= max);

  function commit(next: number) {
    const normalized = normalizeNumber(next, min, max);
    onChange(formatValue(normalized, step, precision));
  }

  return (
    <div className={`min-w-0 ${className}`}>
      {label ? (
        <label className="mb-2 block text-xs font-semibold text-muted">
          {label}
        </label>
      ) : null}
      <div className="grid min-h-11 min-w-0 grid-cols-[42px_minmax(0,1fr)_42px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-lowest)] shadow-sm transition focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
        <button
          type="button"
          onClick={() => commit(safeCurrent - step)}
          disabled={!canDecrease}
          className="flex min-w-0 items-center justify-center border-r border-[var(--border)] text-[var(--muted)] transition hover:bg-[rgba(121,0,243,0.07)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Disminuir"
        >
          <Minus size={16} />
        </button>
        <input
          type="text"
          inputMode={inputMode}
          value={rawValue}
          disabled={disabled}
          onChange={(event) => {
            const nextValue = event.target.value;
            const pattern =
              inputMode === "decimal" ? /^-?\d*([.,]\d*)?$/ : /^-?\d*$/;
            if (nextValue === "" || pattern.test(nextValue)) {
              onChange(nextValue.replace(",", "."));
            }
          }}
          onBlur={(event) => {
            if (event.target.value === "") return;
            const next = Number(event.target.value);
            if (Number.isFinite(next)) commit(next);
          }}
          className={`min-w-0 border-0 bg-transparent px-1 py-2 text-center font-semibold text-[var(--on-surface)] outline-none disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => commit(safeCurrent + step)}
          disabled={!canIncrease}
          className="flex min-w-0 items-center justify-center border-l border-[var(--border)] text-[var(--muted)] transition hover:bg-[rgba(121,0,243,0.07)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Aumentar"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
