"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Notice from "../../components/notice";
import { signOutCurrentSession } from "../../lib/auth/sign-out";
import {
  buildFullName,
  readProfileWithFallback,
  updateProfileWithFallback,
  type UserRole,
} from "../../lib/auth/profile";
import { createClient } from "../../lib/supabase/client";

type ProfileInfo = {
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole | null;
  phone: string;
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
    firstName: "",
    lastName: "",
    fullName: "",
    role: null,
    phone: "",
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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

        const nextProfile = await readProfileWithFallback(supabase, user.id);

        if (!mounted) return;

        setProfile(nextProfile);
        setFirstName(nextProfile.firstName);
        setLastName(nextProfile.lastName);
        setPhone(nextProfile.phone);
      } catch (error) {
        if (!mounted) return;

        setNotice({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "No se pudo cargar el perfil.",
        });
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

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();

    try {
      await supabase.auth.updateUser({
        data: {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          full_name: buildFullName(trimmedFirstName, trimmedLastName),
          phone: trimmedPhone,
          ...(profile.role ? { role: profile.role } : {}),
        },
      });

      await updateProfileWithFallback(supabase, {
        userId,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: trimmedPhone,
        role: profile.role,
      });

      const nextProfile = {
        ...profile,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        fullName: buildFullName(trimmedFirstName, trimmedLastName),
        phone: trimmedPhone,
      };

      setProfile(nextProfile);
      setNotice({
        type: "success",
        message: "Perfil actualizado correctamente.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el perfil.",
      });
    } finally {
      setSaving(false);
    }
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
      <div className="mx-auto max-w-3xl app-card p-5 shadow-lg sm:p-8">
        <h1 className="page-title text-2xl sm:text-3xl">Mi perfil</h1>
        <p className="mt-2 text-base text-muted">
          Aqui puedes ver y actualizar los datos de tu cuenta.
        </p>

        {notice && (
          <div className="mt-6">
            <Notice type={notice.type} message={notice.message} />
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
          <div className="app-card-soft space-y-5 p-4 sm:p-6">
            <div>
              <p className="mb-2 small-label">Correo</p>
              <div className="break-words rounded-2xl bg-[#eef2f7] px-4 py-3 text-[var(--on-surface)]">
                {email || "Sin correo"}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block small-label">Nombre</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="app-input"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">Apellidos</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="app-input"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block small-label">Telefono</label>
              <input
                type="tel"
                inputMode="tel"
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
            {signingOut ? "Cerrando..." : "Cerrar sesion"}
          </button>
        </div>
      </div>
    </main>
  );
}
