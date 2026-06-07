"use client";

import type { Provider } from "@supabase/supabase-js";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PasswordField from "../../../components/password-field";
import { getDefaultPathForRole, getSafeInternalPath } from "../../../lib/auth/redirect";
import { readProfileWithFallback } from "../../../lib/auth/profile";
import { getAuthRedirectUrl } from "../../../lib/auth/site-url";
import { createClient } from "../../../lib/supabase/client";

type OAuthProvider = Extract<Provider, "google" | "azure">;

const oauthProviders: Array<{
  provider: OAuthProvider;
  label: string;
  scopes?: string;
}> = [
  { provider: "google", label: "Continuar con Google" },
  { provider: "azure", label: "Continuar con Microsoft", scopes: "email" },
];

function SignInForm() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const nextUrl = getSafeInternalPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error, data } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const userId = data.user.id;

    try {
      const profile = await readProfileWithFallback(supabase, userId);

      if (!profile.role) {
        window.location.replace(`/auth/complete-profile?next=${encodeURIComponent(nextUrl)}`);
        return;
      }

      window.location.replace(getDefaultPathForRole(profile.role, nextUrl));
    } catch (profileError) {
      await supabase.auth.signOut();
      setMessage(
        profileError instanceof Error
          ? profileError.message
          : "No se pudo identificar el tipo de cuenta."
      );
      setLoading(false);
    }
  }

  async function handleOAuthSignIn(providerConfig: (typeof oauthProviders)[number]) {
    setMessage("");
    setOauthLoading(providerConfig.provider);

    const redirectTo = getAuthRedirectUrl(
      `/auth/callback?next=${encodeURIComponent(nextUrl)}`
    );
    const { error } = await supabase.auth.signInWithOAuth({
      provider: providerConfig.provider,
      options: {
        redirectTo,
        ...(providerConfig.scopes ? { scopes: providerConfig.scopes } : {}),
      },
    });

    if (error) {
      setMessage(error.message);
      setOauthLoading(null);
    }
  }

  return (
    <main className="app-page flex items-center justify-center">
      <div className="w-full max-w-md app-card p-5 shadow-lg sm:p-8">
        <div className="mb-6">
          <h1 className="page-title text-2xl sm:text-3xl">Iniciar sesion</h1>
          <p className="mt-2 text-base text-muted">
            Ingresa con tu correo y contrasena.
          </p>
        </div>

        <div className="mb-5 grid gap-3">
          {oauthProviders.map((providerConfig) => (
            <button
              key={providerConfig.provider}
              type="button"
              onClick={() => handleOAuthSignIn(providerConfig)}
              disabled={oauthLoading !== null}
              className="btn-soft w-full disabled:opacity-60"
            >
              {oauthLoading === providerConfig.provider
                ? "Redirigiendo..."
                : providerConfig.label}
            </button>
          ))}
        </div>

        <div className="mb-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-[#d8dde3]" />
          <span>o usa correo</span>
          <span className="h-px flex-1 bg-[#d8dde3]" />
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
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

          <PasswordField
            id="signin-password"
            label="Contrasena"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          <div className="text-right text-sm">
            <Link href="/auth/forgot-password" className="link-primary">
              Olvidaste tu contrasena?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        {message && <p className="info-box mt-4">{message}</p>}

        <p className="mt-6 text-sm text-muted">
          No tienes cuenta?{" "}
          <Link href="/auth/sign-up" className="link-primary">
            Registrate
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="app-page flex items-center justify-center">
          Cargando inicio de sesion...
        </main>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
