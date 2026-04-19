"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

type RoleType = "customer" | "merchant";

export default function SignUpPage() {
  const supabase = createClient();

  const [role, setRole] = useState<RoleType>("customer");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.user && !data.session) {
      setMessage("Registro exitoso. Revisa tu correo para confirmar tu cuenta.");
    } else {
      setMessage("Cuenta creada correctamente.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold">Crear cuenta</h1>
          <p className="mt-3 text-gray-400">
            Elige cómo usarás la plataforma y completa tus datos.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl bg-gray-900 p-6 shadow-lg">
            <h2 className="mb-5 text-2xl font-semibold">Selecciona tu tipo de cuenta</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setRole("customer")}
                className={`rounded-2xl border p-5 text-left transition ${
                  role === "customer"
                    ? "border-blue-500 bg-blue-600/10"
                    : "border-gray-700 bg-gray-800 hover:bg-gray-800/80"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xl font-semibold">Cliente</span>
                  {role === "customer" && (
                    <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold">
                      Seleccionado
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-300">
                  Busca productos cercanos en el mapa, compara opciones y realiza reservas.
                </p>

                <div className="mt-4 space-y-1 text-sm text-gray-400">
                  <p>• Buscar productos</p>
                  <p>• Ver tiendas cercanas</p>
                  <p>• Reservar y cancelar reservas</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole("merchant")}
                className={`rounded-2xl border p-5 text-left transition ${
                  role === "merchant"
                    ? "border-green-500 bg-green-600/10"
                    : "border-gray-700 bg-gray-800 hover:bg-gray-800/80"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xl font-semibold">Vendedor</span>
                  {role === "merchant" && (
                    <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold">
                      Seleccionado
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-300">
                  Registra tu negocio, administra tu tienda, productos, stock y reservas.
                </p>

                <div className="mt-4 space-y-1 text-sm text-gray-400">
                  <p>• Registrar negocio y tienda</p>
                  <p>• Gestionar productos</p>
                  <p>• Ver reservas del local</p>
                </div>
              </button>
            </div>
          </section>

          <section className="rounded-2xl bg-gray-900 p-6 shadow-lg">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">
                {role === "customer" ? "Registro de cliente" : "Registro de vendedor"}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                {role === "customer"
                  ? "Crea tu cuenta para buscar y reservar productos."
                  : "Crea tu cuenta para publicar y administrar tu tienda."}
              </p>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm">Nombre completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">Correo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 outline-none focus:border-gray-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full rounded-xl px-4 py-3 font-semibold transition disabled:opacity-60 ${
                  role === "customer"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {loading
                  ? "Registrando..."
                  : role === "customer"
                  ? "Crear cuenta de cliente"
                  : "Crear cuenta de vendedor"}
              </button>
            </form>

            {message && (
              <p className="mt-4 rounded-xl bg-gray-800 p-4 text-sm text-gray-200">
                {message}
              </p>
            )}

            <p className="mt-6 text-sm text-gray-400">
              ¿Ya tienes cuenta?{" "}
              <Link href="/auth/sign-in" className="text-cyan-400 hover:underline">
                Inicia sesión
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}