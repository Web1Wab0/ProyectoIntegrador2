"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function SignInPage() {
  const supabase = createClient();
  const router = useRouter();
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
  const nextUrl = searchParams.get("next") || "/";
  window.location.replace(nextUrl);
  return;
}

    await supabase.auth.signOut();
    setMessage("Rol de usuario no válido.");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 p-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Iniciar sesión</h1>
        <p className="text-gray-400 mb-6">
          Ingresa con tu correo y contraseña.
        </p>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="block mb-2 text-sm">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-600 px-4 py-3 font-semibold hover:bg-cyan-700 disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded-lg bg-gray-800 p-3 text-sm text-gray-200">
            {message}
          </p>
        )}

        <p className="mt-6 text-sm text-gray-400">
          ¿No tienes cuenta?{" "}
          <Link href="/auth/sign-up" className="text-cyan-400 hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </main>
  );
}