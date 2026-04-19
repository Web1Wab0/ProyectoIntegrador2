"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

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
};

export default function MerchantSetupPage() {
  const supabase = createClient();
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

        const { data: storeData, error: storeError } = await supabase
          .from("stores")
          .select(
            "id, store_name, address_text, district, city, country, latitude, longitude"
          )
          .eq("business_id", businessData.id)
          .limit(1)
          .maybeSingle<StoreRow>();

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
          setLatitude(String(storeData.latitude ?? ""));
          setLongitude(String(storeData.longitude ?? ""));
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
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
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
      const { data: createdBusiness, error: businessInsertError } = await supabase
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

    if (!storeId) {
      const { error: storeInsertError } = await supabase
  .from("stores")
  .insert({
    business_id: currentBusinessId,
    store_name: storeName,
    address_text: addressText,
    district: district || null,
    city: city || "Ica",
    country: country || "Perú",
    latitude: lat,
    longitude: lng,
    status: "pending",
    is_active: true,
  });

if (storeInsertError) {
  setMessage(storeInsertError.message);
  setSaving(false);
  return;
}

    } else {
      const { error: storeUpdateError } = await supabase
        .from("stores")
        .update({
          store_name: storeName,
          address_text: addressText,
          district: district || null,
          city: city || "Ica",
          country: country || "Perú",
          latitude: lat,
          longitude: lng,
        })
        .eq("id", storeId);

      if (storeUpdateError) {
        setMessage(storeUpdateError.message);
        setSaving(false);
        return;
      }
    }

    setMessage("Negocio y tienda guardados correctamente.");
setSaving(false);
router.refresh();
return;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Cargando datos del local...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-gray-900 p-8 shadow-lg">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Configuración del local</h1>
            <p className="mt-2 text-gray-400">
              Registra tu negocio y la ubicación de tu tienda.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium hover:bg-gray-700"
          >
            Volver
          </Link>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          <section className="rounded-xl bg-gray-800 p-5">
            <h2 className="mb-4 text-xl font-semibold">Datos del negocio</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm">Nombre del negocio</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">RUC</label>
                <input
                  type="text"
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-gray-800 p-5">
            <h2 className="mb-4 text-xl font-semibold">Datos de la tienda</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm">Nombre de la tienda</label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm">Dirección</label>
                <input
                  type="text"
                  value={addressText}
                  onChange={(e) => setAddressText(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">Distrito</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">Ciudad</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">País</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="rounded-lg bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-700"
                >
                  Usar mi ubicación actual
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm">Latitud</label>
                <input
                  type="text"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">Longitud</label>
                <input
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 outline-none"
                />
              </div>
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-green-600 px-5 py-3 font-semibold hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar negocio y tienda"}
          </button>
        </form>

        {message && (
          <p className="mt-5 rounded-lg bg-gray-800 p-4 text-sm text-gray-200">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}