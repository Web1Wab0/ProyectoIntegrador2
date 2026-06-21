"use client";

import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

type Faq = {
  audience: "Cliente" | "Vendedor";
  question: string;
  answer: string;
};

const faqs: Faq[] = [
  {
    audience: "Cliente",
    question: "¿AhorraPe cobra por reservar?",
    answer:
      "No. La plataforma facilita la reserva para recojo y no procesa pagos en esta versión.",
  },
  {
    audience: "Cliente",
    question: "¿Cómo encuentro tiendas cercanas?",
    answer:
      "Permite el acceso a tu ubicación y el mapa mostrará tiendas dentro del radio seleccionado.",
  },
  {
    audience: "Cliente",
    question: "¿Puedo mezclar productos de distintas tiendas?",
    answer:
      "No. Cada reserva pertenece a una sola tienda para evitar confusiones en el recojo.",
  },
  {
    audience: "Cliente",
    question: "¿Cómo dejo una reseña?",
    answer:
      "La opción aparece en Mis reservas después de que el vendedor marque la reserva como completada.",
  },
  {
    audience: "Cliente",
    question: "¿Qué significa una hora no disponible?",
    answer:
      "Puede estar fuera del horario de atención, haber pasado ya o corresponder a un día cerrado.",
  },
  {
    audience: "Vendedor",
    question: "¿Cuándo aparece mi tienda en el mapa?",
    answer:
      "Después de guardar correctamente sus datos y ubicación. Puede aparecer aunque todavía no tenga productos.",
  },
  {
    audience: "Vendedor",
    question: "¿Cómo agrego productos?",
    answer:
      "Ingresa al panel del vendedor, abre Productos y registra nombre, categoría, precio, stock e imagen.",
  },
  {
    audience: "Vendedor",
    question: "¿Qué ocurre cuando recibo una reserva?",
    answer:
      "Aparecerá en Reservas del local y recibirás una notificación en la campana. Podrás aprobarla, marcarla lista o cancelarla.",
  },
  {
    audience: "Vendedor",
    question: "¿Cómo se calculan los reportes?",
    answer:
      "Se utilizan visitas pseudónimas, reservas y estados registrados dentro del rango de fechas seleccionado.",
  },
];

export default function FaqList() {
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<"Todos" | "Cliente" | "Vendedor">(
    "Todos"
  );
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return faqs.filter(
      (item) =>
        (audience === "Todos" || item.audience === audience) &&
        (!term ||
          item.question.toLowerCase().includes(term) ||
          item.answer.toLowerCase().includes(term))
    );
  }, [audience, search]);

  return (
    <>
      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar una pregunta..."
          className="app-input pl-11"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["Todos", "Cliente", "Vendedor"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setAudience(option)}
            className={
              audience === option
                ? "chip-selected px-4 py-2 text-sm"
                : "rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold"
            }
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)]">
        {filtered.map((item) => {
          const open = openQuestion === item.question;
          return (
            <article
              key={item.question}
              className="border-b border-[var(--border)] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => setOpenQuestion(open ? null : item.question)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                aria-expanded={open}
              >
                <span>
                  <span className="mr-2 text-xs font-semibold uppercase text-[var(--primary)]">
                    {item.audience}
                  </span>
                  <span className="font-semibold">{item.question}</span>
                </span>
                <ChevronDown
                  className={`shrink-0 transition ${open ? "rotate-180" : ""}`}
                  size={18}
                />
              </button>
              {open ? (
                <p className="px-4 pb-4 leading-7 text-muted">{item.answer}</p>
              ) : null}
            </article>
          );
        })}
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-muted">
            No encontramos una pregunta con esos términos.
          </p>
        ) : null}
      </div>
    </>
  );
}
