"use client";

import { BookOpenCheck, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import Notice from "./notice";

type Receipt = {
  code: string;
  fullName: string;
  email: string;
  type: string;
  detail: string;
  request: string;
  createdAt: string;
};

export default function ComplaintForm() {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState({
    complaintType: "reclamo",
    documentType: "DNI",
    documentNumber: "",
    fullName: "",
    address: "",
    email: "",
    phone: "",
    goodOrService: "servicio",
    amount: "",
    detail: "",
    consumerRequest: "",
  });
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");

    const { data, error: submitError } = await supabase.rpc(
      "submit_complaint",
      {
        p_complaint_type: form.complaintType,
        p_document_type: form.documentType,
        p_document_number: form.documentNumber.trim(),
        p_full_name: form.fullName.trim(),
        p_address: form.address.trim(),
        p_email: form.email.trim(),
        p_phone: form.phone.trim(),
        p_good_or_service: form.goodOrService,
        p_amount: form.amount ? Number(form.amount) : null,
        p_detail: form.detail.trim(),
        p_consumer_request: form.consumerRequest.trim(),
      }
    );

    if (submitError) {
      setError(
        submitError.code === "PGRST202"
          ? "Falta ejecutar supabase/comprehensive_expansion.sql para habilitar el Libro de Reclamaciones."
          : submitError.message
      );
      setSending(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const nextReceipt: Receipt = {
      code: row?.complaint_code ?? "Pendiente",
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      type: form.complaintType,
      detail: form.detail.trim(),
      request: form.consumerRequest.trim(),
      createdAt: new Date().toLocaleString("es-PE"),
    };
    setReceipt(nextReceipt);

    void fetch("/api/support/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "complaint",
        reference: nextReceipt.code,
        payload: { ...form, amount: form.amount || null },
      }),
    }).catch(() => undefined);

    setSending(false);
  }

  if (receipt) {
    return (
      <section className="print-receipt">
        <div className="success-box">
          Registro generado correctamente. Conserva el código de seguimiento.
        </div>
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-high)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--primary)]">
                Constancia académica
              </p>
              <h2 className="mt-1 text-2xl font-bold">{receipt.code}</h2>
            </div>
            <BookOpenCheck className="text-[var(--primary)]" />
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Fecha</dt><dd>{receipt.createdAt}</dd></div>
            <div><dt className="text-muted">Tipo</dt><dd className="capitalize">{receipt.type}</dd></div>
            <div><dt className="text-muted">Consumidor</dt><dd>{receipt.fullName}</dd></div>
            <div><dt className="text-muted">Correo</dt><dd>{receipt.email}</dd></div>
          </dl>
          <div className="mt-4">
            <p className="text-sm text-muted">Detalle</p>
            <p className="mt-1 whitespace-pre-wrap">{receipt.detail}</p>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted">Pedido</p>
            <p className="mt-1 whitespace-pre-wrap">{receipt.request}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          Esta constancia pertenece a un módulo demostrativo de un proyecto
          académico y no afirma sustituir el Libro de Reclamaciones de una
          empresa formal.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-primary print-hidden mt-5"
        >
          <Printer size={18} />
          Imprimir constancia
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      {error ? <Notice type="error" message={error} /> : null}

      <div className="info-box">
        Módulo demostrativo para fines académicos. Una operación comercial
        formal debe validar sus obligaciones específicas con un profesional.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block small-label">Tipo de registro</label>
          <select
            value={form.complaintType}
            onChange={(event) => updateField("complaintType", event.target.value)}
            className="app-input"
          >
            <option value="reclamo">Reclamo</option>
            <option value="queja">Queja</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block small-label">Producto o servicio</label>
          <select
            value={form.goodOrService}
            onChange={(event) => updateField("goodOrService", event.target.value)}
            className="app-input"
          >
            <option value="servicio">Servicio</option>
            <option value="producto">Producto</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
        <div>
          <label className="mb-2 block small-label">Documento</label>
          <select
            value={form.documentType}
            onChange={(event) => updateField("documentType", event.target.value)}
            className="app-input"
          >
            <option>DNI</option>
            <option>CE</option>
            <option>Pasaporte</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block small-label">Número</label>
          <input
            value={form.documentNumber}
            onChange={(event) => updateField("documentNumber", event.target.value)}
            required
            className="app-input"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block small-label">Nombre completo</label>
        <input
          value={form.fullName}
          onChange={(event) => updateField("fullName", event.target.value)}
          required
          className="app-input"
        />
      </div>

      <div>
        <label className="mb-2 block small-label">Dirección</label>
        <input
          value={form.address}
          onChange={(event) => updateField("address", event.target.value)}
          required
          className="app-input"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block small-label">Correo</label>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            required
            className="app-input"
          />
        </div>
        <div>
          <label className="mb-2 block small-label">Teléfono</label>
          <input
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            className="app-input"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block small-label">Monto reclamado (opcional)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.amount}
          onChange={(event) => updateField("amount", event.target.value)}
          className="app-input"
        />
      </div>

      <div>
        <label className="mb-2 block small-label">Detalle</label>
        <textarea
          value={form.detail}
          onChange={(event) => updateField("detail", event.target.value)}
          required
          minLength={10}
          rows={5}
          className="app-input"
        />
      </div>

      <div>
        <label className="mb-2 block small-label">Pedido del consumidor</label>
        <textarea
          value={form.consumerRequest}
          onChange={(event) => updateField("consumerRequest", event.target.value)}
          required
          minLength={5}
          rows={4}
          className="app-input"
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="btn-primary justify-self-start disabled:opacity-60"
      >
        <BookOpenCheck size={18} />
        {sending ? "Registrando..." : "Registrar reclamo o queja"}
      </button>
    </form>
  );
}
