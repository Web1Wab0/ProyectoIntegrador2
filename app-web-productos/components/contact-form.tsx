"use client";

import { Send } from "lucide-react";
import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import Notice from "./notice";

export default function ContactForm() {
  const supabase = useMemo(() => createClient(), []);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setNotice(null);

    const payload = {
      full_name: fullName.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
    };

    const { data, error } = await supabase.rpc("submit_support_request", {
      p_full_name: payload.full_name,
      p_email: payload.email,
      p_subject: payload.subject,
      p_message: payload.message,
    });

    if (error) {
      setNotice({
        type: "error",
        message:
          error.code === "PGRST202"
            ? "Falta ejecutar supabase/comprehensive_expansion.sql para habilitar soporte."
            : error.message,
      });
      setSending(false);
      return;
    }

    void fetch("/api/support/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "support",
        reference: data,
        payload,
      }),
    }).catch(() => undefined);

    setFullName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setSending(false);
    setNotice({
      type: "success",
      message: "Tu solicitud fue registrada. El equipo podrá revisarla desde el panel de soporte.",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {notice ? <Notice type={notice.type} message={notice.message} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block small-label">Nombre completo</label>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            className="app-input"
          />
        </div>
        <div>
          <label className="mb-2 block small-label">Correo</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="app-input"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block small-label">Asunto</label>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
          className="app-input"
          placeholder="Ejemplo: problema con una reserva"
        />
      </div>

      <div>
        <label className="mb-2 block small-label">Mensaje</label>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          minLength={10}
          rows={6}
          className="app-input"
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="btn-primary justify-self-start disabled:opacity-60"
      >
        <Send size={18} />
        {sending ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}
