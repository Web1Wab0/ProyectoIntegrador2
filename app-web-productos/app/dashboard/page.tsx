"use client";

import Link from "next/link";
import { Boxes, LogOut, MapPinned, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { signOutCurrentSession } from "../../lib/auth/sign-out";
import PageLoading from "../../components/page-loading";

type UserData = {
  email: string;
};

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/auth/sign-in");
        return;
      }

      setUser({
        email: data.user.email ?? "",
      });

      setLoading(false);
    }

    loadUser();
  }, [router, supabase]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);

    try {
      await signOutCurrentSession(supabase);
    } catch (error) {
      console.error("No se pudo cerrar sesion.", error);
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  if (loading) {
    return <PageLoading label="Cargando panel del vendedor" />;
  }

  return (
    <main className="app-page">
      <div className="mx-auto max-w-4xl app-card p-5 sm:p-8">
        <h1 className="page-title text-2xl sm:text-3xl">Dashboard del local</h1>
        <p className="mt-3 text-base text-muted">
          Sesión iniciada con: <span className="break-words font-semibold text-[var(--on-surface)]">{user?.email}</span>
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/merchant/setup"
            className="app-card-soft group p-4 transition hover:-translate-y-0.5 hover:border-[rgba(121,0,243,0.25)] hover:bg-white hover:shadow-md sm:p-6"
          >
            <MapPinned className="mb-5 text-[var(--primary)]" />
            <h2 className="section-title text-xl">Configurar tienda</h2>
            <p className="mt-2 text-muted">
              Crear o editar datos del negocio y la tienda.
            </p>
          </Link>

          <Link
            href="/merchant/products"
            className="app-card-soft group p-4 transition hover:-translate-y-0.5 hover:border-[rgba(121,0,243,0.25)] hover:bg-white hover:shadow-md sm:p-6"
          >
            <Boxes className="mb-5 text-[var(--secondary)]" />
            <h2 className="section-title text-xl">Productos</h2>
            <p className="mt-2 text-muted">
              Crear, editar y eliminar productos de tu tienda.
            </p>
          </Link>

          <Link
            href="/merchant/reservations"
            className="app-card-soft group p-4 transition hover:-translate-y-0.5 hover:border-[rgba(121,0,243,0.25)] hover:bg-white hover:shadow-md sm:p-6 md:col-span-2"
          >
            <ReceiptText className="mb-5 text-[var(--tertiary)]" />
            <h2 className="section-title text-xl">Reservas</h2>
            <p className="mt-2 text-muted">
              Ver, aprobar, marcar listo o cancelar reservas del local.
            </p>
          </Link>
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="btn-danger mt-8 disabled:opacity-60"
        >
          <LogOut size={18} />
          {signingOut ? "Cerrando..." : "Cerrar sesión"}
        </button>
      </div>
    </main>
  );
}
