"use client";

import Link from "next/link";
import {
  BarChart3,
  CircleUserRound,
  Heart,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase/client";
import { signOutCurrentSession } from "../lib/auth/sign-out";
import { getUserMetadataProfile, readProfileWithFallback } from "../lib/auth/profile";

type RoleType = "customer" | "merchant" | "admin" | null;

type AccountState = {
  email: string | null;
  fullName: string | null;
  role: RoleType;
};

export default function AuthAccessMenu() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const profileRequestIdRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [account, setAccount] = useState<AccountState>({
    email: null,
    fullName: null,
    role: null,
  });

  const applySessionUser = useCallback((user: User | null) => {
    if (!user) {
      setAccount({
        email: null,
        fullName: null,
        role: null,
      });
      return;
    }

    const metadataProfile = getUserMetadataProfile(user);

    setAccount({
      email: user.email ?? null,
      fullName: metadataProfile.fullName || "Usuario",
      role: metadataProfile.role,
    });
  }, []);

  const enrichFromProfile = useCallback(
    (userId: string) => {
      const requestId = profileRequestIdRef.current + 1;
      profileRequestIdRef.current = requestId;

      window.setTimeout(async () => {
        let profile: Awaited<ReturnType<typeof readProfileWithFallback>>;

        try {
          profile = await readProfileWithFallback(supabase, userId);
        } catch {
          return;
        }

        if (profileRequestIdRef.current !== requestId) return;

        setAccount((prev) => {
          if (!prev.email) return prev;

          return {
            email: prev.email,
            fullName: profile.fullName || prev.fullName,
            role: profile.role ?? prev.role,
          };
        });
      }, 0);
    },
    [supabase]
  );

  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      const user = session?.user ?? null;
      applySessionUser(user);

      if (user?.id) enrichFromProfile(user.id);
    }

    loadInitial();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const user = session?.user ?? null;
      applySessionUser(user);

      if (user?.id) enrichFromProfile(user.id);
    });

    return () => {
      mounted = false;
      profileRequestIdRef.current += 1;
      subscription.unsubscribe();
    };
  }, [applySessionUser, enrichFromProfile, supabase]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setOpen(false);
    profileRequestIdRef.current += 1;
    setAccount({
      email: null,
      fullName: null,
      role: null,
    });

    try {
      await signOutCurrentSession(supabase);
    } catch (error) {
      console.error("No se pudo cerrar sesion.", error);
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  const isLoggedIn = !!account.email;
  const initials = (account.fullName || account.email || "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="relative max-w-full">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 sm:px-4"
        style={{
          background: "linear-gradient(135deg, #7900f3, #b68aff)",
        }}
      >
        {isLoggedIn ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            {initials}
          </span>
        ) : (
          <CircleUserRound size={18} />
        )}
        <span className="hidden min-[360px]:inline">
          {isLoggedIn ? "Mi cuenta" : "Acceso"}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 z-[9999] mt-3 w-[calc(100vw-2rem)] max-w-72 rounded-xl border border-[var(--border)] p-2 shadow-xl sm:w-72"
          style={{
            background: "var(--surface-lowest)",
            color: "var(--on-surface)",
            boxShadow: "0 12px 40px var(--shadow)",
          }}
        >
          {!isLoggedIn ? (
            <>
              <Link
                href="/auth/sign-in"
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                style={{ color: "var(--on-surface)" }}
              >
                Iniciar sesión
              </Link>

              <Link
                href="/auth/sign-up"
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                style={{ color: "var(--on-surface)" }}
              >
                Registrarse
              </Link>
            </>
          ) : (
            <>
              <div
                className="mb-2 rounded-2xl p-4"
                style={{ background: "var(--surface-high)" }}
              >
                <p className="font-semibold" style={{ color: "var(--on-surface)" }}>
                  {account.fullName || "Usuario"}
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--muted)", wordBreak: "break-word" }}
                >
                  {account.email}
                </p>
                <p
                  className="mt-2 text-xs uppercase tracking-wide"
                  style={{ color: "#7900f3" }}
                >
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
                className="block rounded-2xl px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                style={{ color: "var(--on-surface)" }}
              >
                Ver perfil
              </Link>

              {account.role === "customer" && (
                <>
                  <Link
                    href="/customer/reservations"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                    style={{ color: "var(--on-surface)" }}
                  >
                    Mis reservas
                  </Link>
                  <Link
                    href="/favorites"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                    style={{ color: "var(--on-surface)" }}
                  >
                    <Heart size={17} />
                    Favoritos
                  </Link>
                </>
              )}

              {account.role === "merchant" && (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                    style={{ color: "var(--on-surface)" }}
                  >
                    Dashboard
                  </Link>

                  <Link
                    href="/merchant/products"
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                    style={{ color: "var(--on-surface)" }}
                  >
                    Mis productos
                  </Link>

                  <Link
                    href="/merchant/reservations"
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                    style={{ color: "var(--on-surface)" }}
                  >
                    Reservas del local
                  </Link>
                  <Link
                    href="/merchant/analytics"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                    style={{ color: "var(--on-surface)" }}
                  >
                    <BarChart3 size={17} />
                    Analítica
                  </Link>
                </>
              )}

              {account.role === "admin" && (
                <Link
                  href="/admin/support"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                  style={{ color: "var(--on-surface)" }}
                >
                  <ShieldCheck size={17} />
                  Soporte administrativo
                </Link>
              )}

              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-4 py-3 font-medium transition hover:bg-[rgba(121,0,243,0.08)]"
                style={{ color: "var(--on-surface)" }}
              >
                <Settings size={17} />
                Preferencias
              </Link>

              <div
                className="my-2"
                style={{ borderTop: "1px solid rgba(44,47,48,0.10)" }}
              />

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left font-medium transition hover:bg-[rgba(220,38,38,0.08)]"
                style={{ color: "#dc2626" }}
              >
                <LogOut size={17} />
                {signingOut ? "Cerrando..." : "Cerrar sesión"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
