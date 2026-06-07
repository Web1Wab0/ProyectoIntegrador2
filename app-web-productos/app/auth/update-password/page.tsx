"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PasswordField from "../../../components/password-field";
import Notice from "../../../components/notice";
import { getPasswordHelpMessage, isStrongPassword } from "../../../lib/auth/password";
import { createClient } from "../../../lib/supabase/client";

function UpdatePasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const processedRef = useRef(false);

  const [sessionReady, setSessionReady] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    async function prepareSession() {
      const code = searchParams.get("code");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        setSessionReady(!!session);

        if (!session) {
          setNotice({
            type: "error",
            message:
              "El enlace ya expiro o no es valido. Solicita uno nuevo.",
          });
        }
      } catch (error) {
        setNotice({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "No se pudo validar el enlace.",
        });
      } finally {
        setLoadingSession(false);
      }
    }

    void prepareSession();
  }, [searchParams, supabase]);

  async function handleUpdatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);

    if (!isStrongPassword(password)) {
      setNotice({ type: "warning", message: getPasswordHelpMessage(password) });
      return;
    }

    if (password !== confirmPassword) {
      setNotice({
        type: "warning",
        message: "Las contrasenas no coinciden.",
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setNotice({ type: "error", message: error.message });
      setSaving(false);
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    setNotice({
      type: "success",
      message: "Contrasena actualizada. Ya puedes iniciar sesion.",
    });
    setSaving(false);
  }

  if (loadingSession) {
    return (
      <main className="app-page flex items-center justify-center">
        Validando enlace...
      </main>
    );
  }

  return (
    <main className="app-page flex items-center justify-center">
      <div className="w-full max-w-md app-card p-5 shadow-lg sm:p-8">
        <h1 className="page-title text-2xl sm:text-3xl">Nueva contrasena</h1>
        <p className="mt-2 text-base text-muted">
          Crea una contrasena segura para recuperar el acceso a tu cuenta.
        </p>

        {notice && (
          <div className="mt-6">
            <Notice type={notice.type} message={notice.message} />
          </div>
        )}

        {sessionReady ? (
          <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
            <PasswordField
              id="new-password"
              label="Nueva contrasena"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              showRules
            />

            <PasswordField
              id="confirm-password"
              label="Confirmar contrasena"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full disabled:opacity-60"
            >
              {saving ? "Actualizando..." : "Actualizar contrasena"}
            </button>
          </form>
        ) : (
          <Link href="/auth/forgot-password" className="btn-primary mt-6 w-full">
            Solicitar nuevo enlace
          </Link>
        )}

        <p className="mt-6 text-sm text-muted">
          Ya tienes acceso?{" "}
          <Link href="/auth/sign-in" className="link-primary">
            Inicia sesion
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="app-page flex items-center justify-center">
          Validando enlace...
        </main>
      }
    >
      <UpdatePasswordForm />
    </Suspense>
  );
}
