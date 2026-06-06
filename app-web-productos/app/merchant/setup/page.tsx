"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import {
  normalizeOpeningHours,
  STORE_DAYS,
  type StoreOpeningHours,
  validateOpeningHours,
} from "../../../lib/store-hours";
import Notice from "../../../components/notice";

const StoreLocationPicker = dynamic(
  () => import("../../../components/store-location-picker"),
  {
    ssr: false,
    loading: () => (
      <div className="info-box">Cargando selector de ubicacion...</div>
    ),
  }
);

type BusinessRow = {
  id: string;
  business_name: string;
  ruc: string | null;
  description: string | null;
};

type StoreRow = {
  id: string;
  store_name: string;
  address_text: string;
  district: string | null;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  opening_hours?: unknown;
};

type AddressSelection = {
  addressText?: string;
  district?: string;
  city?: string;
  country?: string;
};

export default function MerchantSetupPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [ruc, setRuc] = useState("");
  const [description, setDescription] = useState("");

  const [storeName, setStoreName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("Ica");
  const [country, setCountry] = useState("Perú");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [openingHours, setOpeningHours] = useState<StoreOpeningHours>(() =>
    normalizeOpeningHours(null)
  );

  const mapLatitude = Number(latitude);
  const mapLongitude = Number(longitude);
  const hasValidMapCoordinates =
    !Number.isNaN(mapLatitude) &&
    !Number.isNaN(mapLongitude) &&
    mapLatitude >= -90 &&
    mapLatitude <= 90 &&
    mapLongitude >= -180 &&
    mapLongitude <= 180;

  function handleLocationChange(nextLatitude: number, nextLongitude: number) {
    setLatitude(nextLatitude.toFixed(7));
    setLongitude(nextLongitude.toFixed(7));
  }

  function handleAddressSelect(selection: AddressSelection) {
    if (selection.addressText) {
      setAddressText(selection.addressText);
    }

    if (selection.district) {
      setDistrict(selection.district);
    }

    if (selection.city) {
      setCity(selection.city);
    }

    if (selection.country) {
      setCountry(selection.country);
    }
  }

  function updateOpeningDay(
    dayKey: string,
    updates: Partial<StoreOpeningHours[string]>
  ) {
    setOpeningHours((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        ...updates,
      },
    }));
  }

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/sign-in");
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select("id, business_name, ruc, description")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle<BusinessRow>();

      if (businessError) {
        setMessage(businessError.message);
        setLoading(false);
        return;
      }

      if (businessData) {
        setBusinessId(businessData.id);
        setBusinessName(businessData.business_name ?? "");
        setRuc(businessData.ruc ?? "");
        setDescription(businessData.description ?? "");

        const storeWithHours = await supabase
          .from("stores")
          .select(
            "id, store_name, address_text, district, city, country, latitude, longitude, opening_hours"
          )
          .eq("business_id", businessData.id)
          .order("updated_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<StoreRow>();

        const { data: storeData, error: storeError } = storeWithHours.error
          ? await supabase
              .from("stores")
              .select(
                "id, store_name, address_text, district, city, country, latitude, longitude"
              )
              .eq("business_id", businessData.id)
              .order("updated_at", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle<StoreRow>()
          : storeWithHours;

        if (storeError) {
          setMessage(storeError.message);
          setLoading(false);
          return;
        }

        if (storeData) {
          setStoreId(storeData.id);
          setStoreName(storeData.store_name ?? "");
          setAddressText(storeData.address_text ?? "");
          setDistrict(storeData.district ?? "");
          setCity(storeData.city ?? "Ica");
          setCountry(storeData.country ?? "Perú");
          setOpeningHours(normalizeOpeningHours(storeData.opening_hours));
          handleLocationChange(
            Number(storeData.latitude ?? 0),
            Number(storeData.longitude ?? 0)
          );
        }
      }

      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Tu navegador no soporta geolocalización.");
      return;
    }

    setMessage("Obteniendo ubicación...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleLocationChange(
          position.coords.latitude,
          position.coords.longitude
        );
        setMessage("Ubicación cargada correctamente.");
      },
      (error) => {
        setMessage(`No se pudo obtener la ubicación: ${error.message}`);
      }
    );
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setMessage("Latitud y longitud deben ser números válidos.");
      setSaving(false);
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setMessage(
        "La latitud debe estar entre -90 y 90, y la longitud entre -180 y 180."
      );
      setSaving(false);
      return;
    }

    const openingHoursError = validateOpeningHours(openingHours);

    if (openingHoursError) {
      setMessage(openingHoursError);
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Tu sesión ha expirado. Inicia sesión nuevamente.");
      setSaving(false);
      router.push("/auth/sign-in");
      return;
    }

    let currentBusinessId = businessId;

    if (!currentBusinessId) {
      const { data: createdBusiness, error: businessInsertError } =
        await supabase
          .from("businesses")
          .insert({
            owner_user_id: user.id,
            business_name: businessName,
            ruc: ruc || null,
            description: description || null,
          })
          .select("id")
          .single();

      if (businessInsertError) {
        setMessage(businessInsertError.message);
        setSaving(false);
        return;
      }

      currentBusinessId = createdBusiness.id;
      setBusinessId(createdBusiness.id);
    } else {
      const { error: businessUpdateError } = await supabase
        .from("businesses")
        .update({
          business_name: businessName,
          ruc: ruc || null,
          description: description || null,
        })
        .eq("id", currentBusinessId);

      if (businessUpdateError) {
        setMessage(businessUpdateError.message);
        setSaving(false);
        return;
      }
    }

    const storePayload = {
      store_name: storeName,
      address_text: addressText,
      district: district || null,
      city: city || "Ica",
      country: country || "Per\u00fa",
      latitude: lat,
      longitude: lng,
      opening_hours: openingHours,
    };

    let currentStoreId = storeId;

    if (!currentStoreId) {
      const { data: existingStore, error: existingStoreError } = await supabase
        .from("stores")
        .select("id")
        .eq("business_id", currentBusinessId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (existingStoreError) {
        setMessage(existingStoreError.message);
        setSaving(false);
        return;
      }

      if (existingStore) {
        currentStoreId = existingStore.id;
        setStoreId(existingStore.id);
      }
    }

    if (!currentStoreId) {
      const { data: createdStore, error: storeInsertError } = await supabase
        .from("stores")
        .insert({
          business_id: currentBusinessId,
          ...storePayload,
          status: "pending",
          is_active: true,
        })
        .select("id")
        .single();

      if (storeInsertError) {
        setMessage(storeInsertError.message);
        setSaving(false);
        return;
      }

      setStoreId(createdStore.id);
    } else {
      const { error: storeUpdateError } = await supabase
        .from("stores")
        .update(storePayload)
        .eq("id", currentStoreId);

      if (storeUpdateError) {
        setMessage(storeUpdateError.message);
        setSaving(false);
        return;
      }
    }

    setMessage("Negocio y tienda guardados correctamente.");
    setSaving(false);
    router.refresh();
  }

  if (loading) {
    return (
      <main className="app-page flex items-center justify-center">
        Cargando datos del local...
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="mx-auto max-w-3xl app-card p-5 shadow-lg sm:p-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="page-title text-2xl sm:text-3xl">Configuración del local</h1>
            <p className="mt-2 text-muted">
              Registra tu negocio y la ubicación de tu tienda.
            </p>
          </div>

          <Link href="/dashboard" className="btn-soft px-4 py-2 text-sm">
            Volver
          </Link>
        </div>

        {message && (
          <div className="mb-6">
            <Notice
              type={
                message.toLowerCase().includes("correctamente")
                  ? "success"
                  : message.toLowerCase().includes("obteniendo")
                  ? "warning"
                  : "error"
              }
              message={message}
            />
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 sm:space-y-8">
          <section className="app-card-soft p-4 sm:p-5">
            <h2 className="section-title mb-4 text-xl">Datos del negocio</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block small-label">Nombre del negocio</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  className="app-input"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">RUC</label>
                <input
                  type="text"
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  className="app-input"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block small-label">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="app-input"
                />
              </div>
            </div>
          </section>

          <section className="app-card-soft p-4 sm:p-5">
            <h2 className="section-title mb-4 text-xl">Datos de la tienda</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block small-label">Nombre de la tienda</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  className="app-input"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block small-label">Dirección</label>
                <input
                  type="text"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  required
                  className="app-input"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">Distrito</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="app-input"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">Ciudad</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="app-input"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">País</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="app-input"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="btn-secondary"
                >
                  Usar mi ubicación actual
                </button>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block small-label">
                  Buscar o seleccionar ubicación en el mapa
                </label>
                <StoreLocationPicker
                  latitude={hasValidMapCoordinates ? mapLatitude : null}
                  longitude={hasValidMapCoordinates ? mapLongitude : null}
                  city={city}
                  country={country}
                  onLocationChange={handleLocationChange}
                  onAddressSelect={handleAddressSelect}
                />
              </div>

              <div>
                <label className="mb-2 block small-label">Latitud</label>
                <input
                  type="text"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="app-input"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">Longitud</label>
                <input
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="app-input"
                />
              </div>
            </div>
          </section>

          <section className="app-card-soft p-4 sm:p-5">
            <h2 className="section-title mb-4 text-xl">
              Horario de atencion
            </h2>

            <div className="space-y-3">
              {STORE_DAYS.map((day) => {
                const dayHours = openingHours[day.key];

                return (
                  <div
                    key={day.key}
                    className="grid gap-3 rounded-2xl bg-white/60 p-3 sm:p-4 md:grid-cols-[120px_120px_1fr_1fr]"
                  >
                    <div className="font-semibold text-[var(--on-surface)]">
                      {day.label}
                    </div>

                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={dayHours.closed}
                        onChange={(e) =>
                          updateOpeningDay(day.key, {
                            closed: e.target.checked,
                          })
                        }
                      />
                      Cerrado
                    </label>

                    <div>
                      <label className="mb-1 block small-label">Apertura</label>
                      <input
                        type="time"
                        value={dayHours.open}
                        disabled={dayHours.closed}
                        onChange={(e) =>
                          updateOpeningDay(day.key, { open: e.target.value })
                        }
                        className="app-input disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block small-label">Cierre</label>
                      <input
                        type="time"
                        value={dayHours.close}
                        disabled={dayHours.closed}
                        onChange={(e) =>
                          updateOpeningDay(day.key, { close: e.target.value })
                        }
                        className="app-input disabled:opacity-50"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar negocio y tienda"}
          </button>
        </form>
      </div>
    </main>
  );
}
