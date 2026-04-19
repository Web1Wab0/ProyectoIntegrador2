"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

type RoleType = "customer" | "merchant" | "admin" | null;

type AccountState = {
  email: string | null;
  fullName: string | null;
  role: RoleType;
};

export default function AuthAccessMenu() {
  const supabase = useMemo(() => createClient(), []);

  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<AccountState>({
    email: null,
    fullName: null,
    role: null,
  });

  function applySessionUser(user: any | null) {
    if (!user) {
      setAccount({
        email: null,
        fullName: null,
        role: null,
      });
      return;
    }

    setAccount({
      email: user.email ?? null,
      fullName: user.user_metadata?.full_name ?? "Usuario",
      role: (user.user_metadata?.role as RoleType) ?? null,
    });
  }

  async function enrichFromProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", userId)
      .maybeSingle();

    if (!data) return;

    setAccount((prev) => ({
      email: prev.email,
      fullName: data.full_name ?? prev.fullName,
      role: (data.role as RoleType) ?? prev.role,
    }));
  }

  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      const user = session?.user ?? null;
      applySessionUser(user);

      if (user?.id) {
        await enrichFromProfile(user.id);
      }
    }

    loadInitial();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      const user = session?.user ?? null;
      applySessionUser(user);

      if (user?.id) {
        await enrichFromProfile(user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();

    setOpen(false);
    setAccount({
      email: null,
      fullName: null,
      role: null,
    });

    window.location.href = `/?logout=${Date.now()}`;
  }

  const isLoggedIn = !!account.email;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-lg bg-gray-800 px-4 py-2 font-semibold hover:bg-gray-700"
      >
        {isLoggedIn ? "Mi cuenta" : "Acceso"}
      </button>

      {open && (
        <div className="absolute right-0 z-[9999] mt-2 w-72 rounded-xl border border-gray-700 bg-gray-900 p-2 shadow-xl">
          {!isLoggedIn ? (
            <>
              <Link
                href="/auth/sign-in"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-4 py-3 hover:bg-gray-800"
              >
                Iniciar sesión
              </Link>

              <Link
                href="/auth/sign-up"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-4 py-3 hover:bg-gray-800"
              >
                Registrarse
              </Link>
            </>
          ) : (
            <>
              <div className="mb-2 rounded-lg bg-gray-800 p-4">
                <p className="font-semibold text-white">
                  {account.fullName || "Usuario"}
                </p>
                <p className="mt-1 text-sm text-gray-300">{account.email}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-gray-400">
                  {account.role === "customer"
                    ? "Cliente"
                    : account.role === "merchant"
                    ? "Vendedor"
                    : "Cuenta"}
                </p>
              </div>

              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-4 py-3 hover:bg-gray-800"
              >
                Ver perfil
              </Link>

              {account.role === "customer" && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    window.location.href = "/customer/reservations";
                  }}
                  className="block w-full rounded-lg px-4 py-3 text-left hover:bg-gray-800"
                >
                  Mis reservas
                </button>
              )}

              {account.role === "merchant" && (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-4 py-3 hover:bg-gray-800"
                  >
                    Dashboard
                  </Link>

                  <Link
                    href="/merchant/products"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-4 py-3 hover:bg-gray-800"
                  >
                    Mis productos
                  </Link>

                  <Link
                    href="/merchant/reservations"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-4 py-3 hover:bg-gray-800"
                  >
                    Reservas del local
                  </Link>
                </>
              )}

              <div className="my-2 border-t border-gray-700" />

              <button
                type="button"
                onClick={handleSignOut}
                className="block w-full rounded-lg px-4 py-3 text-left text-red-300 hover:bg-gray-800"
              >
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}