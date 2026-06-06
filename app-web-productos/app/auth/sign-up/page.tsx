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
    <main className="app-page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="page-title text-center text-3xl sm:text-4xl">Crear cuenta</h1>
          <p className="mt-3 text-center text-base text-muted">
            Elige cómo usarás la plataforma y completa tus datos.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="app-card p-4 shadow-lg sm:p-6">
            <h2 className="section-title text-xl sm:text-2xl">
              Selecciona tu tipo de cuenta
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setRole("customer")}
                className={`card-option text-left ${
                  role === "customer" ? "card-option-active" : ""
                }`}
              >
                <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="section-title text-xl">Cliente</span>

                  {role === "customer" && (
                    <span className="chip-selected">Seleccionado</span>
                  )}
                </div>

                <p className="text-sm leading-7 text-muted">
                  Busca productos cercanos en el mapa, compara opciones y
                  realiza reservas.
                </p>

                <div className="mt-4 space-y-2 text-sm text-soft">
                  <p>• Buscar productos</p>
                  <p>• Ver tiendas cercanas</p>
                  <p>• Reservar y cancelar reservas</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole("merchant")}
                className={`card-option text-left ${
                  role === "merchant" ? "card-option-active" : ""
                }`}
              >
                <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="section-title text-xl">Vendedor</span>

                  {role === "merchant" && (
                    <span className="chip-selected">Seleccionado</span>
                  )}
                </div>

                <p className="text-sm leading-7 text-muted">
                  Registra tu negocio, administra tu tienda, productos, stock y
                  reservas.
                </p>

                <div className="mt-4 space-y-2 text-sm text-soft">
                  <p>• Registrar negocio y tienda</p>
                  <p>• Gestionar productos</p>
                  <p>• Ver reservas del local</p>
                </div>
              </button>
            </div>
          </section>

          <section className="app-card p-4 shadow-lg sm:p-6">
            <div className="mb-6">
              <h2 className="section-title text-xl sm:text-2xl">
                {role === "customer"
                  ? "Registro de cliente"
                  : "Registro de vendedor"}
              </h2>
              <p className="mt-2 text-base text-muted">
                {role === "customer"
                  ? "Crea tu cuenta para buscar y reservar productos."
                  : "Crea tu cuenta para publicar y administrar tu tienda."}
              </p>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="mb-2 block small-label">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="app-input"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">Correo</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="app-input"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="app-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-60"
              >
                {loading
                  ? "Registrando..."
                  : role === "customer"
                  ? "Crear cuenta de cliente"
                  : "Crear cuenta de vendedor"}
              </button>
            </form>

            {message && (
              <p className="info-box mt-4 text-sm">
                {message}
              </p>
            )}

            <p className="mt-6 text-sm text-muted">
              ¿Ya tienes cuenta?{" "}
              <Link href="/auth/sign-in" className="link-primary">
                Inicia sesión
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
