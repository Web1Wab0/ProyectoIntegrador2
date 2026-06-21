"use client";

import { BellRing, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { getAnalyticsOptOut, setAnalyticsOptOut } from "../../lib/analytics";
import { useToast } from "../../components/toast-provider";
import PageLoading from "../../components/page-loading";
import ThemeToggle from "../../components/theme-toggle";

type Preferences = {
  in_app: boolean;
  push_enabled: boolean;
  reservation_updates: boolean;
  reservation_reminders: boolean;
  price_drop: boolean;
  back_in_stock: boolean;
  low_stock: boolean;
};

const defaults: Preferences = {
  in_app: true,
  push_enabled: false,
  reservation_updates: true,
  reservation_reminders: true,
  price_drop: true,
  back_in_stock: true,
  low_stock: true,
};

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export default function NotificationPreferencesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [preferences, setPreferences] = useState(defaults);
  const [analyticsDisabled, setAnalyticsDisabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth/sign-in?next=/notifications");
        return;
      }
      const id = auth.session.user.id;
      setUserId(id);
      setAnalyticsDisabled(getAnalyticsOptOut());
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", id)
        .maybeSingle();
      if (data) setPreferences({ ...defaults, ...data });
      setLoading(false);
    })();
  }, [router, supabase]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: userId, ...preferences, updated_at: new Date().toISOString() });
    await supabase
      .from("profiles")
      .update({ analytics_opt_out: analyticsDisabled })
      .eq("id", userId);
    setAnalyticsOptOut(analyticsDisabled);
    showToast({
      type: error ? "error" : "success",
      message: error ? error.message : "Preferencias actualizadas.",
    });
    setSaving(false);
  }

  async function enablePush() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      showToast({ type: "warning", message: "La clave pública VAPID aún no está configurada en Vercel." });
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      showToast({ type: "warning", message: "Este navegador no admite notificaciones push." });
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      showToast({ type: "warning", message: "No se concedió permiso para notificaciones." });
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });

    if (!error) {
      setPreferences((current) => ({ ...current, push_enabled: true }));
    }
    showToast({ type: error ? "error" : "success", message: error ? error.message : "Notificaciones push activadas." });
  }

  if (loading) return <PageLoading label="Cargando preferencias" />;

  const options: Array<{ key: keyof Preferences; label: string; description: string }> = [
    { key: "in_app", label: "Campana y alertas internas", description: "Muestra novedades mientras usas AhorraPe." },
    { key: "reservation_updates", label: "Cambios en reservas", description: "Confirmación, listo, cancelación y entrega." },
    { key: "reservation_reminders", label: "Recordatorios de recojo", description: "Aviso aproximado una hora antes." },
    { key: "price_drop", label: "Bajadas de precio", description: "Para productos que guardaste como favoritos." },
    { key: "back_in_stock", label: "Reposición de stock", description: "Cuando vuelve un producto favorito." },
    { key: "low_stock", label: "Stock bajo", description: "Disponible para vendedores y su inventario." },
  ];

  return (
    <main className="app-page">
      <div className="mx-auto max-w-3xl">
        <h1 className="page-title text-3xl">Preferencias</h1>
        <p className="mt-2 text-muted">Controla tema, privacidad y avisos de tu cuenta.</p>

        <section className="app-card mt-6 p-5 sm:p-7">
          <h2 className="section-title text-xl">Apariencia</h2>
          <div className="mt-4 overflow-x-auto"><ThemeToggle /></div>
        </section>

        <section className="app-card mt-5 p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <BellRing className="text-[var(--primary)]" />
            <div>
              <h2 className="section-title text-xl">Notificaciones</h2>
              <p className="text-sm text-muted">Solo se envían avisos transaccionales.</p>
            </div>
          </div>
          <div className="mt-5 divide-y divide-[var(--border)]">
            {options.map((option) => (
              <label key={option.key} className="flex cursor-pointer items-start justify-between gap-4 py-4">
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="mt-1 block text-sm text-muted">{option.description}</span>
                </span>
                <input
                  type="checkbox"
                  checked={preferences[option.key]}
                  onChange={(event) =>
                    setPreferences((current) => ({ ...current, [option.key]: event.target.checked }))
                  }
                  className="mt-1 h-5 w-5 accent-[var(--primary)]"
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={enablePush} className="btn-secondary mt-4">
            Activar push en este dispositivo
          </button>
        </section>

        <section className="app-card mt-5 p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-[var(--secondary)]" />
            <h2 className="section-title text-xl">Privacidad</h2>
          </div>
          <label className="mt-4 flex cursor-pointer items-start justify-between gap-4">
            <span>
              <span className="block font-medium">Desactivar analítica opcional</span>
              <span className="mt-1 block text-sm text-muted">
                No registraremos visitas pseudónimas a tiendas o productos.
              </span>
            </span>
            <input
              type="checkbox"
              checked={analyticsDisabled}
              onChange={(event) => setAnalyticsDisabled(event.target.checked)}
              className="mt-1 h-5 w-5 accent-[var(--primary)]"
            />
          </label>
        </section>

        <button type="button" onClick={save} disabled={saving} className="btn-primary mt-6">
          {saving ? "Guardando..." : "Guardar preferencias"}
        </button>
      </div>
    </main>
  );
}
