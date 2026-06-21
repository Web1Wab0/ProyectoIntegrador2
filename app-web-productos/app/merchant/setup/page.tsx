"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import {
  normalizeOpeningHours,
  STORE_DAYS,
  type StoreOpeningHours,
  validateOpeningHours,
} from "../../../lib/store-hours";
import {
  buildFullName,
  readProfileWithFallback,
  splitFullName,
  updateProfileWithFallback,
} from "../../../lib/auth/profile";
import Notice from "../../../components/notice";
import PageLoading from "../../../components/page-loading";

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
  description?: string | null;
  image_url?: string | null;
  opening_hours?: unknown;
};

type AddressSelection = {
  addressText?: string;
  district?: string;
  city?: string;
  country?: string;
};

const MAX_STORE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_STORE_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function validateStoreImage(file: File) {
  if (!ALLOWED_STORE_IMAGE_EXTENSIONS[file.type]) {
    return "La imagen de la tienda debe ser JPG, PNG o WebP.";
  }

  if (file.size > MAX_STORE_IMAGE_SIZE_BYTES) {
    return "La imagen de la tienda no debe superar los 5 MB.";
  }

  return null;
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false;

  return (
    error.code === "42703" ||
    error.message?.toLowerCase().includes("column") ||
    error.message?.toLowerCase().includes("schema cache")
  );
}

export default function MerchantSetupPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const storeImageObjectUrlRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [ownerFirstName, setOwnerFirstName] = useState("");
  const [ownerLastName, setOwnerLastName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ruc, setRuc] = useState("");

  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [storeImageUrl, setStoreImageUrl] = useState("");
  const [storeImageFile, setStoreImageFile] = useState<File | null>(null);
  const [storeImagePreviewUrl, setStoreImagePreviewUrl] = useState("");
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

  function handleStoreImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] ?? null;

    if (storeImageObjectUrlRef.current) {
      URL.revokeObjectURL(storeImageObjectUrlRef.current);
      storeImageObjectUrlRef.current = null;
    }

    if (!selectedFile) {
      setStoreImageFile(null);
      setStoreImagePreviewUrl(storeImageUrl);
      return;
    }

    const imageError = validateStoreImage(selectedFile);

    if (imageError) {
      setStoreImageFile(null);
      setMessage(imageError);
      e.target.value = "";
      return;
    }

    setStoreImageFile(selectedFile);
    const previewUrl = URL.createObjectURL(selectedFile);
    storeImageObjectUrlRef.current = previewUrl;
    setStoreImagePreviewUrl(previewUrl);
    setMessage("");
  }

  async function uploadStoreImageIfNeeded(userId: string, currentStoreId: string) {
    if (!storeImageFile) return storeImageUrl || null;

    const imageError = validateStoreImage(storeImageFile);

    if (imageError) {
      throw new Error(imageError);
    }

    const fileExt = ALLOWED_STORE_IMAGE_EXTENSIONS[storeImageFile.type];
    const fileName = `${currentStoreId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("store-images")
      .upload(filePath, storeImageFile, {
        upsert: false,
        contentType: storeImageFile.type,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from("store-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
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
    return () => {
      if (storeImageObjectUrlRef.current) {
        URL.revokeObjectURL(storeImageObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/sign-in");
        return;
      }

      try {
        const profile = await readProfileWithFallback(supabase, user.id);
        setOwnerFirstName(profile.firstName);
        setOwnerLastName(profile.lastName);
        setOwnerPhone(profile.phone);
      } catch {
        const splitName = splitFullName(user.user_metadata?.full_name);
        setOwnerFirstName(splitName.firstName);
        setOwnerLastName(splitName.lastName);
        setOwnerPhone(
          typeof user.user_metadata?.phone === "string"
            ? user.user_metadata.phone
            : ""
        );
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
        setRuc(businessData.ruc ?? "");
        setStoreDescription(businessData.description ?? "");

        const splitBusinessName = splitFullName(businessData.business_name);
        setOwnerFirstName((prev) => prev || splitBusinessName.firstName);
        setOwnerLastName((prev) => prev || splitBusinessName.lastName);

        const storeWithHours = await supabase
          .from("stores")
          .select(
            "id, store_name, description, image_url, address_text, district, city, country, latitude, longitude, opening_hours"
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
          setStoreDescription(
            storeData.description ?? businessData.description ?? ""
          );
          setStoreImageUrl(storeData.image_url ?? "");
          setStoreImagePreviewUrl(storeData.image_url ?? "");
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
      } else {
        const splitMetadataName = splitFullName(user.user_metadata?.full_name);
        setOwnerFirstName((prev) => prev || splitMetadataName.firstName);
        setOwnerLastName((prev) => prev || splitMetadataName.lastName);
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

    const trimmedOwnerFirstName = ownerFirstName.trim();
    const trimmedOwnerLastName = ownerLastName.trim();
    const trimmedOwnerPhone = ownerPhone.trim();
    const ownerFullName = buildFullName(
      trimmedOwnerFirstName,
      trimmedOwnerLastName
    );

    if (!trimmedOwnerFirstName || !trimmedOwnerLastName || !trimmedOwnerPhone) {
      setMessage("Completa nombre, apellidos y telefono del propietario.");
      setSaving(false);
      return;
    }

    try {
      await supabase.auth.updateUser({
        data: {
          first_name: trimmedOwnerFirstName,
          last_name: trimmedOwnerLastName,
          full_name: ownerFullName,
          phone: trimmedOwnerPhone,
          role: "merchant",
        },
      });

      await updateProfileWithFallback(supabase, {
        userId: user.id,
        firstName: trimmedOwnerFirstName,
        lastName: trimmedOwnerLastName,
        phone: trimmedOwnerPhone,
        role: "merchant",
      });
    } catch (profileError) {
      setMessage(
        profileError instanceof Error
          ? profileError.message
          : "No se pudo actualizar el propietario."
      );
      setSaving(false);
      return;
    }

    let currentBusinessId = businessId;

    if (!currentBusinessId) {
      const { data: createdBusiness, error: businessInsertError } =
        await supabase
          .from("businesses")
          .insert({
            owner_user_id: user.id,
            business_name: ownerFullName,
            ruc: ruc || null,
            description: storeDescription || null,
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
          business_name: ownerFullName,
          ruc: ruc || null,
          description: storeDescription || null,
        })
        .eq("id", currentBusinessId);

      if (businessUpdateError) {
        setMessage(businessUpdateError.message);
        setSaving(false);
        return;
      }
    }

    const storePayloadBase = {
      store_name: storeName,
      address_text: addressText,
      district: district || null,
      city: city || "Ica",
      country: country || "Per\u00fa",
      latitude: lat,
      longitude: lng,
      opening_hours: openingHours,
    };
    const storePayload = {
      ...storePayloadBase,
      description: storeDescription || null,
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
      let { data: createdStore, error: storeInsertError } = await supabase
        .from("stores")
        .insert({
          business_id: currentBusinessId,
          ...storePayload,
          status: "active",
          is_active: true,
        })
        .select("id")
        .single();

      if (storeInsertError && isMissingColumnError(storeInsertError)) {
        const fallbackInsert = await supabase
          .from("stores")
          .insert({
            business_id: currentBusinessId,
            ...storePayloadBase,
            status: "active",
            is_active: true,
          })
          .select("id")
          .single();

        createdStore = fallbackInsert.data;
        storeInsertError = fallbackInsert.error;
      }

      if (storeInsertError) {
        setMessage(storeInsertError.message);
        setSaving(false);
        return;
      }

      if (!createdStore) {
        setMessage("No se pudo confirmar la tienda creada.");
        setSaving(false);
        return;
      }

      currentStoreId = createdStore.id;
      setStoreId(createdStore.id);
    } else {
      let { error: storeUpdateError } = await supabase
        .from("stores")
        .update(storePayload)
        .eq("id", currentStoreId);

      if (storeUpdateError && isMissingColumnError(storeUpdateError)) {
        const fallbackUpdate = await supabase
          .from("stores")
          .update(storePayloadBase)
          .eq("id", currentStoreId);

        storeUpdateError = fallbackUpdate.error;
      }

      if (storeUpdateError) {
        setMessage(storeUpdateError.message);
        setSaving(false);
        return;
      }
    }

    if (currentStoreId && storeImageFile) {
      try {
        const uploadedStoreImageUrl = await uploadStoreImageIfNeeded(
          user.id,
          currentStoreId
        );

        const { error: imageUpdateError } = await supabase
          .from("stores")
          .update({ image_url: uploadedStoreImageUrl })
          .eq("id", currentStoreId);

        if (imageUpdateError) {
          if (isMissingColumnError(imageUpdateError)) {
            setMessage(
              "La tienda se guardo, pero falta ejecutar supabase/store_images_and_google_maps.sql para guardar la imagen."
            );
          } else {
            setMessage(imageUpdateError.message);
          }
          setSaving(false);
          return;
        }

        setStoreImageUrl(uploadedStoreImageUrl ?? "");
        setStoreImagePreviewUrl(uploadedStoreImageUrl ?? "");
        setStoreImageFile(null);
      } catch (imageError) {
        setMessage(
          imageError instanceof Error
            ? imageError.message
            : "No se pudo subir la imagen de la tienda."
        );
        setSaving(false);
        return;
      }
    }

    setMessage("Propietario y tienda guardados correctamente.");
    setSaving(false);
    router.refresh();
  }

  if (loading) {
    return <PageLoading label="Cargando configuración de la tienda" />;
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
            <h2 className="section-title mb-4 text-xl">Datos del propietario</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block small-label">Nombre del dueño</label>
                <input
                  type="text"
                  value={ownerFirstName}
                  onChange={(e) => setOwnerFirstName(e.target.value)}
                  required
                  className="app-input"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">Apellidos</label>
                <input
                  type="text"
                  value={ownerLastName}
                  onChange={(e) => setOwnerLastName(e.target.value)}
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

              <div>
                <label className="mb-2 block small-label">Telefono</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  required
                  className="app-input"
                  placeholder="Ejemplo: 987654321"
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
                <label className="mb-2 block small-label">Descripcion</label>
                <textarea
                  value={storeDescription}
                  onChange={(e) => setStoreDescription(e.target.value)}
                  rows={4}
                  className="app-input"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block small-label">
                  Imagen de la tienda
                </label>
                <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
                  <div className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-[#eef2f7]">
                    {storeImagePreviewUrl ? (
                      <Image
                        src={storeImagePreviewUrl}
                        alt={storeName || "Imagen de tienda"}
                        fill
                        sizes="220px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-sm text-muted">Sin imagen</span>
                    )}
                  </div>

                  <div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleStoreImageFileChange}
                      className="app-input"
                    />
                    <p className="mt-2 text-xs text-muted">
                      Usa una foto clara del local. Formatos JPG, PNG o WebP,
                      maximo 5 MB.
                    </p>
                  </div>
                </div>
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
