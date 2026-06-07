"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getDefaultPathForRole, getSafeInternalPath } from "../../../lib/auth/redirect";
import { ensureProfileForUser, normalizeRole } from "../../../lib/auth/profile";
import { createClient } from "../../../lib/supabase/client";

function AuthCallbackContent() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const processedRef = useRef(false);
  const [message, setMessage] = useState("Validando acceso...");

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    async function handleCallback() {
      const code = searchParams.get("code");
      const nextPath = getSafeInternalPath(searchParams.get("next"));
      const requestedRole = normalizeRole(searchParams.get("role"));

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.user) {
          setMessage("No se pudo crear la sesion. Intenta iniciar sesion nuevamente.");
          return;
        }

        const profile = await ensureProfileForUser(
          supabase,
          session.user,
          requestedRole
        );

        if (!profile.role) {
          window.location.replace(
            `/auth/complete-profile?next=${encodeURIComponent(nextPath)}`
          );
          return;
        }

        window.location.replace(getDefaultPathForRole(profile.role, nextPath));
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudo completar el acceso."
        );
      }
    }

    void handleCallback();
  }, [searchParams, supabase]);

  return (
    <main className="app-page flex items-center justify-center">
      <div className="w-full max-w-md app-card p-5 text-center shadow-lg sm:p-8">
        <h1 className="page-title text-2xl sm:text-3xl">Conectando cuenta</h1>
        <p className="mt-4 text-muted">{message}</p>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="app-page flex items-center justify-center">
          Validando acceso...
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
