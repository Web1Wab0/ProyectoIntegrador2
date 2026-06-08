"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Notice from "../../../components/notice";
import PasswordField from "../../../components/password-field";
import {
  getPasswordHelpMessage,
  isStrongPassword,
} from "../../../lib/auth/password";
import { hasPasswordSet } from "../../../lib/auth/password-state";
import { getDefaultPathForRole, getSafeInternalPath } from "../../../lib/auth/redirect";
import {
  buildFullName,
  getUserMetadataProfile,
  readProfileWithFallback,
  upsertProfileWithFallback,
  type ProfileDetails,
  type UserRole,
} from "../../../lib/auth/profile";
import { createClient } from "../../../lib/supabase/client";

function getDisplayName(profile: ProfileDetails) {
  return profile.fullName || buildFullName(profile.firstName, profile.lastName);
}

function SetPasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const nextPath = getSafeInternalPath(searchParams.get("next"), "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          window.location.replace("/auth/sign-in");
          return;
        }

        if (hasPasswordSet(user)) {
          window.location.replace("/profile");
          return;
        }

        const metadataProfile = getUserMetadataProfile(user);
        let nextProfile = metadataProfile;

        try {
          const databaseProfile = await readProfileWithFallback(supabase, user.id);

          nextProfile = {
            firstName: databaseProfile.firstName || metadataProfile.firstName,
            lastName: databaseProfile.lastName || metadataProfile.lastName,
            fullName: databaseProfile.fullName || metadataProfile.fullName,
            phone: databaseProfile.phone || metadataProfile.phone,
            role: databaseProfile.role ?? metadataProfile.role,
          };
        } catch {
          nextProfile = metadataProfile;
        }

        if (!nextProfile.role) {
          window.location.replace(
            `/auth/complete-profile?next=${encodeURIComponent(nextPath || "/")}`
          );
          return;
        }

        if (!mounted) return;

        setUserId(user.id);
        setEmail(user.email ?? "");
        setProfile(nextProfile);
        setRole(nextProfile.role);
      } catch (error) {
        if (!mounted) return;

        setNotice({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "No se pudo cargar la cuenta.",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAccount();

    return () => {
      mounted = false;
    };
  }, [nextPath, supabase]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);

    if (!userId || !profile || !role) return;

    if (!isStrongPassword(password)) {
      setNotice({ type: "warning", message: getPasswordHelpMessage(password) });
      return;
    }

    if (password !== confirmPassword) {
      setNotice({
        type: "warning",
        message: "Las contrasenas no coinciden.",
      });
      return;
    }

    setSaving(true);

    try {
      const fullName = getDisplayName(profile);
      const { data: refreshedUser } = await supabase.auth.getUser();
      const currentMetadata = refreshedUser.user?.user_metadata ?? {};
      const { error } = await supabase.auth.updateUser({
        password,
        data: {
          ...currentMetadata,
          first_name: profile.firstName,
          last_name: profile.lastName,
          full_name: fullName,
          phone: profile.phone,
          role,
          password_set: true,
        },
      });

      if (error) {
        throw error;
      }

      try {
        await upsertProfileWithFallback(supabase, {
          userId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          role,
        });
      } catch (profileError) {
        console.error("Password was saved, but profile sync failed", profileError);
      }

      window.location.replace(nextPath || getDefaultPathForRole(role));
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la contrasena.",
      });
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="app-page flex items-center justify-center">
        Preparando cuenta...
      </main>
    );
  }

  const displayName = profile ? getDisplayName(profile) : "";

  return (
    <main className="app-page flex items-center justify-center">
      <div className="w-full max-w-md app-card p-5 shadow-lg sm:p-8">
        <h1 className="page-title text-2xl sm:text-3xl">
          Crea tu contrasena
        </h1>
        <p className="mt-2 text-base text-muted">
          Tu cuenta de Google ya esta conectada. Agrega una contrasena para
          poder ingresar tambien con correo y contrasena.
        </p>

        {notice && (
          <div className="mt-6">
            <Notice type={notice.type} message={notice.message} />
          </div>
        )}

        {profile && role ? (
          <>
            <div className="info-box mt-6 space-y-2 text-sm">
              <p>
                <span className="font-semibold text-[var(--text)]">Correo: </span>
                {email || "Correo de Google"}
              </p>
              <p>
                <span className="font-semibold text-[var(--text)]">Nombre: </span>
                {displayName || "Nombre de Google"}
              </p>
            </div>

            <form onSubmit={handleSave} className="mt-6 space-y-4">
              <PasswordField
                id="google-new-password"
                label="Nueva contrasena"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                showRules
              />

              <PasswordField
                id="google-confirm-password"
                label="Confirmar contrasena"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar contrasena"}
              </button>
            </form>
          </>
        ) : (
          <Link href="/auth/sign-in" className="btn-primary mt-6 w-full">
            Volver a iniciar sesion
          </Link>
        )}
      </div>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="app-page flex items-center justify-center">
          Preparando cuenta...
        </main>
      }
    >
      <SetPasswordForm />
    </Suspense>
  );
}
