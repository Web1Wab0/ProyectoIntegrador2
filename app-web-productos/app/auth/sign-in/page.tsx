"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

function getSafeInternalPath(nextUrl: string | null) {
  if (!nextUrl || !nextUrl.startsWith("/") || nextUrl.startsWith("//")) {
    return "/";
  }

  if (nextUrl.includes("\\")) {
    return "/";
  }

  try {
    const parsedUrl = new URL(nextUrl, window.location.origin);

    if (parsedUrl.origin !== window.location.origin) {
      return "/";
    }

    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return "/";
  }
}

function SignInForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const userId = data.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError) {
      await supabase.auth.signOut();
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    if (!profile?.role) {
      await supabase.auth.signOut();
      setMessage("No se pudo identificar el tipo de cuenta.");
      setLoading(false);
      return;
    }

    if (profile.role === "merchant") {
      window.location.replace("/dashboard");
      return;
    }

    if (profile.role === "customer") {
      const nextUrl = getSafeInternalPath(searchParams.get("next"));
      window.location.replace(nextUrl);
      return;
    }

    await supabase.auth.signOut();
    setMessage("Rol de usuario no válido.");
    setLoading(false);
  }

  return (
    <main className="app-page flex items-center justify-center px-6">
      <div className="w-full max-w-md app-card p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="page-title text-3xl">Iniciar sesión</h1>
          <p className="mt-2 text-base text-muted">
            Ingresa con tu correo y contraseña.
          </p>
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

          <div>
            <label className="mb-2 block small-label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="app-input"
              placeholder="••••••••"
            />
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
          ¿No tienes cuenta?{" "}
          <Link href="/auth/sign-up" className="link-primary">
            Regístrate
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
        <main className="app-page flex items-center justify-center px-6">
          Cargando inicio de sesion...
        </main>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
