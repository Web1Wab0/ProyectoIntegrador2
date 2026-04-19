"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type UserData = {
  email: string;
};

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

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
    await supabase.auth.signOut();
    router.push("/auth/sign-in");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Cargando...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl rounded-2xl bg-gray-900 p-8 shadow-lg">
        <h1 className="mb-3 text-3xl font-bold">Dashboard del local</h1>
        <p className="mb-8 text-gray-300">
          Sesión iniciada con: <strong>{user?.email}</strong>
        </p>

        <div className="grid gap-4 md:grid-cols-2">
  <Link
    href="/merchant/setup"
    className="rounded-xl bg-gray-800 p-5 hover:bg-gray-700"
  >
    <h2 className="mb-2 text-xl font-semibold">Configurar negocio</h2>
    <p className="text-gray-300">
      Crear o editar datos del negocio y la tienda.
    </p>
  </Link>

  <Link
    href="/merchant/products"
    className="rounded-xl bg-gray-800 p-5 hover:bg-gray-700"
  >
    <h2 className="mb-2 text-xl font-semibold">Productos</h2>
    <p className="text-gray-300">
      Crear, editar y eliminar productos de tu tienda.
    </p>
  </Link>

  <Link
    href="/merchant/reservations"
    className="rounded-xl bg-gray-800 p-5 hover:bg-gray-700 md:col-span-2"
  >
    <h2 className="mb-2 text-xl font-semibold">Reservas</h2>
    <p className="text-gray-300">
      Ver, aprobar, marcar listo o cancelar reservas del local.
    </p>
  </Link>
</div>

        <button
          onClick={handleSignOut}
          className="mt-8 rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-700"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}