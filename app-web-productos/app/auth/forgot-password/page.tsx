"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Notice from "../../../components/notice";
import { getAuthRedirectUrl } from "../../../lib/auth/site-url";
import { createClient } from "../../../lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setNotice(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getAuthRedirectUrl("/auth/update-password"),
    });

    if (error) {
      setNotice({ type: "error", message: error.message });
      setLoading(false);
      return;
    }

    setNotice({
      type: "success",
      message:
        "Si el correo esta registrado, recibiras un enlace para crear una nueva contrasena.",
    });
    setLoading(false);
  }

  return (
    <main className="app-page flex items-center justify-center">
      <div className="w-full max-w-md app-card p-5 shadow-lg sm:p-8">
        <h1 className="page-title text-2xl sm:text-3xl">
          Recuperar contrasena
        </h1>
        <p className="mt-2 text-base text-muted">
          Escribe el correo de tu cuenta y te enviaremos un enlace de
          recuperacion.
        </p>

        {notice && (
          <div className="mt-6">
            <Notice type={notice.type} message={notice.message} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block small-label">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="app-input"
              placeholder="tucorreo@ejemplo.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Recordaste tu contrasena?{" "}
          <Link href="/auth/sign-in" className="link-primary">
            Inicia sesion
          </Link>
        </p>
      </div>
    </main>
  );
}
