"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { signOutCurrentSession } from "../../lib/auth/sign-out";
import Notice from "../../components/notice";

type ProfileInfo = {
  full_name: string | null;
  role: "customer" | "merchant" | "admin" | null;
  phone: string | null;
};

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const [profile, setProfile] = useState<ProfileInfo>({
    full_name: null,
    role: null,
    phone: null,
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          window.location.replace("/auth/sign-in?next=/profile");
          return;
        }

        if (!mounted) return;

        setUserId(user.id);
        setEmail(user.email ?? "");

        const { data } = await supabase
          .from("profiles")
          .select("full_name, role, phone")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        const nextProfile = {
          full_name: data?.full_name ?? null,
          role: (data?.role as ProfileInfo["role"]) ?? null,
          phone: data?.phone ?? null,
        };

        setProfile(nextProfile);
        setFullName(nextProfile.full_name ?? "");
        setPhone(nextProfile.phone ?? "");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) return;

    setSaving(true);
    setNotice(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      })
      .eq("id", userId);

    if (error) {
      setNotice({ type: "error", message: error.message });
      setSaving(false);
      return;
    }

    setProfile((prev) => ({
      ...prev,
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
    }));

    setNotice({
      type: "success",
      message: "Perfil actualizado correctamente.",
    });

    setSaving(false);
  }

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
    return (
      <main className="app-page flex items-center justify-center">
        Cargando perfil...
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="mx-auto max-w-3xl app-card p-8 shadow-lg">
        <h1 className="page-title text-3xl">Mi perfil</h1>
        <p className="mt-2 text-base text-muted">
          Aquí puedes ver y actualizar los datos de tu cuenta.
        </p>

        {notice && <div className="mt-6"><Notice type={notice.type} message={notice.message} /></div>}

        <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
          <div className="app-card-soft space-y-5 p-6">
            <div>
              <p className="mb-2 small-label">Correo</p>
              <div className="rounded-2xl bg-[#eef2f7] px-4 py-3 text-[var(--on-surface)]">
                {email || "Sin correo"}
              </div>
            </div>

            <div>
              <label className="mb-2 block small-label">Nombre completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="mb-2 block small-label">Teléfono</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ejemplo: 987654321"
                className="app-input"
              />
            </div>

            <div>
              <p className="mb-2 small-label">Tipo de cuenta</p>
              <div className="rounded-2xl bg-[#eef2f7] px-4 py-3 text-[var(--on-surface)]">
                {profile.role === "customer"
                  ? "Cliente"
                  : profile.role === "merchant"
                  ? "Vendedor"
                  : "No definido"}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn-soft">
            Ir al inicio
          </Link>

          {profile.role === "customer" && (
            <Link href="/customer/reservations" className="btn-primary">
              Ver mis reservas
            </Link>
          )}

          {profile.role === "merchant" && (
            <Link href="/dashboard" className="btn-secondary">
              Ir al dashboard
            </Link>
          )}

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="btn-danger disabled:opacity-60"
          >
            {signingOut ? "Cerrando..." : "Cerrar sesión"}
          </button>
        </div>
      </div>
    </main>
  );
}
