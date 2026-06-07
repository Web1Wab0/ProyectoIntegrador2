"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Notice from "../../../components/notice";
import { getDefaultPathForRole, getSafeInternalPath } from "../../../lib/auth/redirect";
import {
  buildFullName,
  getUserMetadataProfile,
  readProfileWithFallback,
  upsertProfileWithFallback,
  type UserRole,
} from "../../../lib/auth/profile";
import { createClient } from "../../../lib/supabase/client";

type RoleChoice = Exclude<UserRole, "admin">;

function CompleteProfileForm() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const nextPath = getSafeInternalPath(searchParams.get("next"));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<RoleChoice>("customer");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          window.location.replace("/auth/sign-in");
          return;
        }

        const metadataProfile = getUserMetadataProfile(user);
        let profile = metadataProfile;

        try {
          profile = await readProfileWithFallback(supabase, user.id);
        } catch {
          profile = metadataProfile;
        }

        if (!mounted) return;

        setUserId(user.id);
        setFirstName(profile.firstName || metadataProfile.firstName);
        setLastName(profile.lastName || metadataProfile.lastName);
        setPhone(profile.phone || metadataProfile.phone);

        if (profile.role === "customer" || profile.role === "merchant") {
          setRole(profile.role);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) return;

    setSaving(true);
    setNotice(null);

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedFirstName || !trimmedLastName || !trimmedPhone) {
      setNotice({
        type: "warning",
        message: "Completa nombre, apellidos y telefono.",
      });
      setSaving(false);
      return;
    }

    try {
      await supabase.auth.updateUser({
        data: {
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          full_name: buildFullName(trimmedFirstName, trimmedLastName),
          phone: trimmedPhone,
          role,
        },
      });

      await upsertProfileWithFallback(supabase, {
        userId,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        phone: trimmedPhone,
        role,
      });

      window.location.replace(getDefaultPathForRole(role, nextPath));
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo completar el perfil.",
      });
      setSaving(false);
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
    <main className="app-page flex items-center justify-center">
      <div className="w-full max-w-2xl app-card p-5 shadow-lg sm:p-8">
        <h1 className="page-title text-2xl sm:text-3xl">Completa tu perfil</h1>
        <p className="mt-2 text-base text-muted">
          Necesitamos estos datos para terminar de crear tu cuenta.
        </p>

        {notice && (
          <div className="mt-6">
            <Notice type={notice.type} message={notice.message} />
          </div>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRole("customer")}
              className={`card-option ${
                role === "customer" ? "card-option-active" : ""
              }`}
            >
              <span className="section-title text-lg">Cliente</span>
            </button>

            <button
              type="button"
              onClick={() => setRole("merchant")}
              className={`card-option ${
                role === "merchant" ? "card-option-active" : ""
              }`}
            >
              <span className="section-title text-lg">Vendedor</span>
            </button>
          </div>

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
            <label className="mb-2 block small-label">Numero de telefono</label>
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

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Continuar"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="app-page flex items-center justify-center">
          Cargando perfil...
        </main>
      }
    >
      <CompleteProfileForm />
    </Suspense>
  );
}
