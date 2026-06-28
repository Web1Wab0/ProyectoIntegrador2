"use client";

import { Check, ChevronDown, Search, Tag, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

export type CategoryPickerOption = {
  id: string;
  name: string;
  is_age_restricted?: boolean;
};

type CategoryPickerProps = {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryPickerOption[];
  label?: string;
};

export default function CategoryPicker({
  value,
  onChange,
  categories,
  label = "Categoría",
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const shouldReduceMotion = useReducedMotion() === true;

  const selected = categories.find((category) => category.id === value) ?? null;
  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((category) =>
      category.name.toLowerCase().includes(term)
    );
  }, [categories, search]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
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
    window.setTimeout(() => searchRef.current?.focus(), 80);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <label className="mb-2 block small-label">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-[10px] border border-transparent bg-[var(--surface-high)] px-4 py-3 text-left outline-none transition hover:border-[rgba(121,0,243,0.25)] hover:bg-[var(--surface-lowest)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(121,0,243,0.09)] text-[var(--primary)]">
            <Tag size={17} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {selected?.name ?? "Sin categoría"}
            </span>
            <span className="block text-xs text-muted">
              {selected?.is_age_restricted
                ? "Producto restringido 18+"
                : selected
                ? "Categoría seleccionada"
                : "Opcional"}
            </span>
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="surface-popover absolute left-0 right-0 top-[calc(100%+0.6rem)] z-[10070] overflow-hidden rounded-2xl p-3"
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
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-high)] px-3 py-2">
              <Search size={16} className="shrink-0 text-muted" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar categoría"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-soft)]"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-muted transition hover:text-[var(--primary)]"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>

            <div className="scrollbar-none mt-3 max-h-64 space-y-2 overflow-y-auto">
              <CategoryOption
                name="Sin categoría"
                description="No clasificar este producto"
                selected={value === ""}
                onClick={() => choose("")}
              />

              {filteredCategories.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-center text-sm text-muted">
                  No hay categorías con ese nombre.
                </div>
              ) : (
                filteredCategories.map((category) => (
                  <CategoryOption
                    key={category.id}
                    name={category.name}
                    description={
                      category.is_age_restricted
                        ? "Requiere validación 18+"
                        : "Disponible para productos"
                    }
                    restricted={category.is_age_restricted}
                    selected={category.id === value}
                    onClick={() => choose(category.id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CategoryOption({
  name,
  description,
  restricted = false,
  selected,
  onClick,
}: {
  name: string;
  description: string;
  restricted?: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
        selected
          ? "border-[var(--primary)] bg-[rgba(121,0,243,0.08)]"
          : "border-[var(--border)] bg-[var(--surface-lowest)] hover:border-[rgba(121,0,243,0.25)] hover:bg-[var(--surface-high)]"
      }`}
    >
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{name}</span>
          {restricted ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              18+
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {description}
        </span>
      </span>
      {selected ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
          <Check size={15} />
        </span>
      ) : null}
    </button>
  );
}
