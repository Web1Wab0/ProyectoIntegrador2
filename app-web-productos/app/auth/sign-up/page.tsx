"use client";

import type { Provider } from "@supabase/supabase-js";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PasswordField from "../../../components/password-field";
import { getPasswordHelpMessage, isStrongPassword } from "../../../lib/auth/password";
import { buildFullName } from "../../../lib/auth/profile";
import { getAuthRedirectUrl } from "../../../lib/auth/site-url";
import { createClient } from "../../../lib/supabase/client";

type RoleType = "customer" | "merchant";
type OAuthProvider = Extract<Provider, "google">;

const oauthProviders: Array<{
  provider: OAuthProvider;
  label: string;
}> = [
  { provider: "google", label: "Continuar con Google" },
];

function getFriendlySignUpErrorMessage(message: string) {
  if (message.toLowerCase().includes("database error saving new user")) {
    return [
      "No se pudo crear la cuenta porque la correccion de base de datos de Supabase no esta completa.",
      "Ejecuta nuevamente app-web-productos/supabase/fix_auth_signup_profile_trigger.sql en Supabase SQL Editor y vuelve a intentarlo.",
    ].join(" ");
  }

  return message;
}

function SignUpForm() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const initialMessage = getFriendlySignUpErrorMessage(
    searchParams.get("auth_error") ?? ""
  );

  const [role, setRole] = useState<RoleType>("customer");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!isStrongPassword(password)) {
      setMessage(getPasswordHelpMessage(password));
      setLoading(false);
      return;
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();
    const fullName = buildFullName(trimmedFirstName, trimmedLastName);
    const redirectTo = getAuthRedirectUrl(`/auth/callback?role=${role}`);

    const { error, data } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          full_name: fullName,
          phone: trimmedPhone,
          role,
        },
      },
    });

    if (error) {
      setMessage(getFriendlySignUpErrorMessage(error.message));
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

  async function handleOAuthSignUp(providerConfig: (typeof oauthProviders)[number]) {
    setMessage("");
    setOauthLoading(providerConfig.provider);

    const redirectTo = getAuthRedirectUrl(`/auth/callback?role=${role}`);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: providerConfig.provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      setMessage(getFriendlySignUpErrorMessage(error.message));
      setOauthLoading(null);
    }
  }

  return (
    <main className="app-page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="page-title text-center text-3xl sm:text-4xl">
            Crear cuenta
          </h1>
          <p className="mt-3 text-center text-base text-muted">
            Elige como usaras la plataforma y completa tus datos.
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
                  <p>Buscar productos</p>
                  <p>Ver tiendas cercanas</p>
                  <p>Reservar y cancelar reservas</p>
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
                  <p>Registrar propietario y tienda</p>
                  <p>Gestionar productos</p>
                  <p>Ver reservas del local</p>
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

            <div className="mb-5 grid gap-3">
              {oauthProviders.map((providerConfig) => (
                <button
                  key={providerConfig.provider}
                  type="button"
                  onClick={() => handleOAuthSignUp(providerConfig)}
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

            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block small-label">Nombre</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block small-label">Apellidos</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="app-input"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block small-label">
                  Numero de telefono
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="app-input"
                  placeholder="Ejemplo: 987654321"
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
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>

              <PasswordField
                id="signup-password"
                label="Contrasena"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                showRules
              />

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

            {message && <p className="info-box mt-4 text-sm">{message}</p>}

            <p className="mt-6 text-sm text-muted">
              Ya tienes cuenta?{" "}
              <Link href="/auth/sign-in" className="link-primary">
                Inicia sesion
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <main className="app-page flex items-center justify-center">
          Cargando registro...
        </main>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
