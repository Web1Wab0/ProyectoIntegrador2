"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import Notice from "../../components/notice";

type ProfileInfo = {
  full_name: string | null;
  role: "customer" | "merchant" | "admin" | null;
  phone: string | null;
};

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.replace("/");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Cargando perfil...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-2xl bg-gray-900 p-8 shadow-lg">
        <h1 className="mb-2 text-3xl font-bold">Mi perfil</h1>
        <p className="mb-8 text-gray-400">
          Aquí puedes ver y actualizar los datos de tu cuenta.
        </p>

        {notice && <Notice type={notice.type} message={notice.message} />}

        <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
          <div className="rounded-2xl bg-gray-800 p-6 space-y-4">
            <div>
              <p className="mb-2 text-sm text-gray-400">Correo</p>
              <div className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white">
                {email || "Sin correo"}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Nombre completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                Teléfono
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ejemplo: 987654321"
                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <p className="mb-2 text-sm text-gray-400">Tipo de cuenta</p>
              <div className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-white">
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
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-gray-800 px-4 py-3 font-semibold hover:bg-gray-700"
          >
            Ir al inicio
          </Link>

          {profile.role === "customer" && (
            <Link
              href="/customer/reservations"
              className="rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700"
            >
              Ver mis reservas
            </Link>
          )}

          {profile.role === "merchant" && (
            <Link
              href="/dashboard"
              className="rounded-lg bg-green-600 px-4 py-3 font-semibold hover:bg-green-700"
            >
              Ir al dashboard
            </Link>
          )}

          <button
            onClick={handleSignOut}
            className="rounded-lg bg-red-600 px-4 py-3 font-semibold hover:bg-red-700"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </main>
  );
}