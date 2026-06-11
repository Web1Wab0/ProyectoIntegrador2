"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import {
  formatOpeningHours,
  normalizeOpeningHours,
  type StoreOpeningHours,
} from "../lib/store-hours";
import AuthAccessMenu from "../components/auth-access-menu";
import Notice from "../components/notice";

const SearchMap = dynamic(() => import("../components/search-map"), {
  ssr: false,
});

const UNCATEGORIZED_ID = "uncategorized";
const NEARBY_STORES_TIMEOUT_MS = 12000;

type SearchResult = {
  store_product_id: string;
  product_id: string;
  product_name: string;
  product_description: string | null;
  brand: string | null;
  category_name: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  store_id: string;
  store_name: string;
  address_text: string;
  district: string | null;
  latitude: number;
  longitude: number;
  distance_meters: number;
  opening_hours: StoreOpeningHours;
};

type StoreCategory = {
  category_id: string | null;
  category_name: string;
  product_count: number;
};

type NearbyStore = {
  store_id: string;
  store_name: string;
  description: string | null;
  image_url: string | null;
  address_text: string;
  district: string | null;
  latitude: number;
  longitude: number;
  distance_meters: number;
  product_count: number;
  categories: StoreCategory[];
  opening_hours: StoreOpeningHours;
};

type MaybeArray<T> = T | T[] | null;

type RawNearbyStore = Omit<
  NearbyStore,
  "categories" | "product_count" | "opening_hours" | "description" | "image_url"
> & {
  description?: string | null;
  image_url?: string | null;
  product_count: number | string | null;
  categories: unknown;
  opening_hours?: unknown;
};

type RawFallbackProduct = {
  category_id: string | null;
  categories: MaybeArray<{
    id: string;
    name: string;
  }>;
};

type RawFallbackStoreProduct = {
  id: string;
  stock: number | null;
  is_available: boolean | null;
  products: MaybeArray<RawFallbackProduct>;
};

type RawFallbackStore = {
  id: string;
  store_name: string;
  description?: string | null;
  image_url?: string | null;
  address_text: string;
  district: string | null;
  latitude: number;
  longitude: number;
  opening_hours?: unknown;
  store_products: RawFallbackStoreProduct[] | null;
};

type RawSearchResult = Omit<SearchResult, "opening_hours"> & {
  opening_hours?: unknown;
};

type SupabaseQueryResponse<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

function firstOrNull<T>(value: MaybeArray<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeStoreCategories(value: unknown): StoreCategory[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const row = item as {
        category_id?: unknown;
        category_name?: unknown;
        product_count?: unknown;
      };

      return {
        category_id:
          typeof row.category_id === "string" ? row.category_id : null,
        category_name:
          typeof row.category_name === "string"
            ? row.category_name
            : "Sin categoria",
        product_count: Number(row.product_count ?? 0),
      };
    })
    .filter((item): item is StoreCategory => item !== null);
}

function normalizeNearbyStore(row: RawNearbyStore): NearbyStore {
  return {
    ...row,
    description: row.description ?? null,
    image_url: row.image_url ?? null,
    product_count: Number(row.product_count ?? 0),
    categories: normalizeStoreCategories(row.categories),
    opening_hours: normalizeOpeningHours(row.opening_hours),
  };
}

function normalizeSearchResult(row: RawSearchResult): SearchResult {
  return {
    ...row,
    opening_hours: normalizeOpeningHours(row.opening_hours),
  };
}

function distanceInMeters(
  originLat: number,
  originLng: number,
  targetLat: number,
  targetLng: number
) {
  const radius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(targetLat - originLat);
  const deltaLng = toRadians(targetLng - originLng);
  const lat1 = toRadians(originLat);
  const lat2 = toRadians(targetLat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false;

  return (
    error.code === "42703" ||
    error.message?.toLowerCase().includes("column") ||
    error.message?.toLowerCase().includes("schema cache")
  );
}

function storeHref(storeId: string, storeProductId?: string) {
  const params = storeProductId
    ? `?product=${encodeURIComponent(storeProductId)}`
    : "";
  return `/stores/${encodeURIComponent(storeId)}${params}`;
}

function StoreImage({
  src,
  alt,
  className = "h-56",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`${className} relative flex w-full items-center justify-center overflow-hidden rounded-3xl bg-[#eef1f4]`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#f7f7f7] to-[#e9edf2] text-sm font-semibold text-muted">
          Sin imagen
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const nearbyStoresRequestIdRef = useRef(0);
  const nearbyStoresAbortRef = useRef<AbortController | null>(null);

  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [lastSearch, setLastSearch] = useState("");
  const [radius, setRadius] = useState("3000");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [nearbyStores, setNearbyStores] = useState<NearbyStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationAttempted, setLocationAttempted] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [searching, setSearching] = useState(false);

  const isSearchMode = results.length > 0;

  const loadNearbyStoresFallback = useCallback(
    async (lat: number, lng: number, signal: AbortSignal) => {
      async function queryStores(includeImage: boolean) {
        const select = `
          id,
          store_name,
          description,
          ${includeImage ? "image_url," : ""}
          address_text,
          district,
          latitude,
          longitude,
          opening_hours,
          store_products (
            id,
            stock,
            is_available,
            products:product_id (
              category_id,
              categories:category_id (
                id,
                name
              )
            )
          )
        `;

        return supabase
          .from("stores")
          .select(select)
          .eq("is_active", true)
          .eq("status", "active")
          .abortSignal(signal);
      }

      let { data, error } = await queryStores(true);

      if (error && isMissingColumnError(error)) {
        const fallback = await queryStores(false);
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw new Error(error.message);

      return (((data as unknown) as RawFallbackStore[]) ?? [])
        .map((store) => {
          const availableStoreProducts = (store.store_products ?? []).filter(
            (storeProduct) =>
              storeProduct.is_available !== false &&
              Number(storeProduct.stock ?? 0) > 0
          );
          const distance = distanceInMeters(
            lat,
            lng,
            Number(store.latitude),
            Number(store.longitude)
          );

          if (distance > Number(radius)) {
            return null;
          }

          const categoriesByKey = new Map<string, StoreCategory>();

          availableStoreProducts.forEach((storeProduct) => {
            const product = firstOrNull(storeProduct.products);
            const category = firstOrNull(product?.categories);
            const categoryId = category?.id ?? product?.category_id ?? null;
            const key = categoryId ?? UNCATEGORIZED_ID;
            const current = categoriesByKey.get(key);

            categoriesByKey.set(key, {
              category_id: categoryId,
              category_name:
                category?.name ?? current?.category_name ?? "Sin categoria",
              product_count: (current?.product_count ?? 0) + 1,
            });
          });

          return {
            store_id: store.id,
            store_name: store.store_name,
            description: store.description ?? null,
            image_url: store.image_url ?? null,
            address_text: store.address_text,
            district: store.district,
            latitude: Number(store.latitude),
            longitude: Number(store.longitude),
            distance_meters: distance,
            product_count: availableStoreProducts.length,
            opening_hours: normalizeOpeningHours(store.opening_hours),
            categories: Array.from(categoriesByKey.values()).sort((a, b) =>
              a.category_name.localeCompare(b.category_name)
            ),
          };
        })
        .filter((store): store is NearbyStore => store !== null)
        .sort((a, b) => a.distance_meters - b.distance_meters)
        .slice(0, 50);
    },
    [radius, supabase]
  );

  const loadNearbyStores = useCallback(
    async (lat: number, lng: number) => {
      nearbyStoresRequestIdRef.current += 1;
      const requestId = nearbyStoresRequestIdRef.current;
      nearbyStoresAbortRef.current?.abort();

      const isCurrentRequest = () =>
        nearbyStoresRequestIdRef.current === requestId;

      async function runWithTimeout<T>(
        task: (signal: AbortSignal) => PromiseLike<T>
      ) {
        const controller = new AbortController();
        nearbyStoresAbortRef.current = controller;
        const timeoutId = window.setTimeout(() => {
          controller.abort();
        }, NEARBY_STORES_TIMEOUT_MS);

        try {
          const result = await task(controller.signal);

          if (controller.signal.aborted) {
            throw new Error(
              "La carga de tiendas tardo demasiado. Intenta nuevamente."
            );
          }

          return result;
        } finally {
          window.clearTimeout(timeoutId);

          if (nearbyStoresAbortRef.current === controller) {
            nearbyStoresAbortRef.current = null;
          }
        }
      }

      setLoadingStores(true);

      try {
        const { data, error } = await runWithTimeout<
          SupabaseQueryResponse<RawNearbyStore[]>
        >((signal) =>
          supabase
            .rpc("search_nearby_stores", {
              p_user_lat: lat,
              p_user_lng: lng,
              p_radius_meters: Number(radius),
              p_limit: 50,
            })
            .abortSignal(signal)
        );

        if (!isCurrentRequest()) return;

        if (error) throw new Error(error.message);

        setNearbyStores(
          ((data as RawNearbyStore[]) ?? []).map(normalizeNearbyStore)
        );
      } catch {
        if (!isCurrentRequest()) return;

        try {
          const fallbackStores = await runWithTimeout((signal) =>
            loadNearbyStoresFallback(lat, lng, signal)
          );

          if (!isCurrentRequest()) return;

          setNearbyStores(fallbackStores);
        } catch (fallbackError) {
          if (!isCurrentRequest()) return;

          const err = fallbackError as Error;
          setNearbyStores([]);
          setNotice({
            type: "error",
            message:
              err.message ||
              "No se pudieron cargar las tiendas cercanas a tu ubicacion.",
          });
        }
      } finally {
        if (isCurrentRequest()) {
          setLoadingStores(false);
        }
      }
    },
    [loadNearbyStoresFallback, radius, supabase]
  );

  useEffect(() => {
    return () => {
      nearbyStoresRequestIdRef.current += 1;
      nearbyStoresAbortRef.current?.abort();
    };
  }, []);

  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationAttempted(true);
      setNotice({
        type: "error",
        message: "Tu navegador no soporta geolocalizacion.",
      });
      return;
    }

    setLoadingLocation(true);
    setLocationAttempted(true);
    setNotice({
      type: "warning",
      message: "Detectando tu ubicacion para mostrar tiendas cercanas...",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLat(position.coords.latitude);
        setUserLng(position.coords.longitude);
        setLoadingLocation(false);
        setNotice({
          type: "success",
          message: "Ubicacion obtenida. Estamos cargando tiendas cercanas.",
        });
      },
      (error) => {
        setLoadingLocation(false);
        setNotice({
          type: "error",
          message: `No se pudo obtener la ubicacion: ${error.message}. Puedes reintentarlo con el boton.`,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      requestUserLocation();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [requestUserLocation]);

  useEffect(() => {
    if (userLat === null || userLng === null) return;

    const timer = window.setTimeout(() => {
      void loadNearbyStores(userLat, userLng);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadNearbyStores, userLat, userLng]);

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!search.trim()) {
      setResults([]);
      setLastSearch("");
      setSelectedResultId(null);
      setNotice({
        type: "warning",
        message: "Escribe un producto para buscar o explora tiendas cercanas.",
      });
      return;
    }

    if (userLat === null || userLng === null) {
      setNotice({
        type: "warning",
        message: "Primero debes permitir u obtener tu ubicacion.",
      });
      return;
    }

    setSearching(true);
    setNotice(null);

    const { data, error } = await supabase.rpc("search_nearby_products", {
      p_search: search.trim(),
      p_user_lat: userLat,
      p_user_lng: userLng,
      p_radius_meters: Number(radius),
      p_limit: 30,
    });

    if (error) {
      setNotice({
        type: "error",
        message: error.message,
      });
      setSearching(false);
      return;
    }

    const rows = ((data as RawSearchResult[]) ?? []).map(normalizeSearchResult);
    setResults(rows);
    setLastSearch(search.trim());
    setSelectedResultId(rows[0]?.store_product_id ?? null);
    setSelectedStoreId(rows[0]?.store_id ?? null);
    setSearching(false);

    if (rows.length === 0) {
      setNotice({
        type: "warning",
        message: "No se encontraron productos cercanos para esa busqueda.",
      });
    }
  }

  function clearSearch() {
    setSearch("");
    setLastSearch("");
    setResults([]);
    setSelectedResultId(null);
    setSelectedStoreId(null);
    setNotice(null);
  }

  const storesTitle = useMemo(() => {
    if (userLat === null || userLng === null) return "Activa tu ubicacion";
    if (isSearchMode) return `Resultados para "${lastSearch}"`;
    return "Tiendas cerca de ti";
  }, [isSearchMode, lastSearch, userLat, userLng]);

  return (
    <main className="min-h-screen bg-white text-[var(--on-surface)]">
      <div className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-10">
          <div className="flex items-center justify-end">
            <AuthAccessMenu />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end">
            <div className="min-w-0">
              <h1 className="page-title text-2xl sm:text-3xl">
                Encuentra tiendas y productos cerca de ti
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
                Explora locales activos en tu zona o busca un producto para
                comparar precios directamente en el mapa.
              </p>
            </div>

            <button
              onClick={requestUserLocation}
              disabled={loadingLocation}
              className="btn-soft justify-self-start border border-[#d1d5db] bg-white lg:justify-self-end"
            >
              {loadingLocation
                ? "Detectando ubicacion..."
                : locationAttempted
                ? "Reintentar ubicacion"
                : "Usar mi ubicacion"}
            </button>
          </div>

          <form
            onSubmit={handleSearch}
            className="grid gap-3 rounded-full border border-[#d1d5db] bg-white p-2 shadow-sm md:grid-cols-[1fr_150px_120px_auto]"
          >
            <input
              type="text"
              placeholder="Busca arroz, leche, gaseosa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-12 rounded-full px-4 text-sm outline-none"
            />

            <select
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="min-h-12 rounded-full bg-[#f7f7f7] px-4 text-sm outline-none"
            >
              <option value="1000">1 km</option>
              <option value="3000">3 km</option>
              <option value="5000">5 km</option>
              <option value="10000">10 km</option>
            </select>

            <button
              type="submit"
              disabled={searching}
              className="min-h-12 rounded-full bg-[#ff385c] px-5 text-sm font-bold text-white transition hover:bg-[#e03150] disabled:opacity-60"
            >
              {searching ? "Buscando" : "Buscar"}
            </button>

            {isSearchMode && (
              <button
                type="button"
                onClick={clearSearch}
                className="min-h-12 rounded-full px-4 text-sm font-semibold text-[#222222] transition hover:bg-[#f7f7f7]"
              >
                Ver tiendas
              </button>
            )}
          </form>

          {notice && <Notice type={notice.type} message={notice.message} />}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-0 lg:grid-cols-[minmax(0,1fr)_48vw]">
        <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">{storesTitle}</h2>
              <p className="mt-1 text-sm text-muted">
                Radio actual: {Number(radius) / 1000} km
                {userLat !== null && userLng !== null
                  ? ` · Tu ubicacion: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}`
                  : ""}
              </p>
            </div>

            {loadingStores && !isSearchMode && (
              <span className="rounded-full bg-[#f7f7f7] px-4 py-2 text-sm text-muted">
                Cargando tiendas...
              </span>
            )}
          </div>

          {userLat === null || userLng === null ? (
            <div className="rounded-3xl border border-[#e5e7eb] bg-[#f7f7f7] p-6 text-sm text-muted">
              Acepta el permiso de ubicacion para ver tiendas cercanas en el
              mapa.
            </div>
          ) : isSearchMode ? (
            <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
              {results.map((item) => (
                <article
                  key={item.store_product_id}
                  onMouseEnter={() => {
                    setSelectedResultId(item.store_product_id);
                    setSelectedStoreId(item.store_id);
                  }}
                  className="group cursor-pointer"
                  onClick={() =>
                    router.push(storeHref(item.store_id, item.store_product_id))
                  }
                >
                  <StoreImage
                    src={item.image_url}
                    alt={item.product_name}
                    className="h-64"
                  />

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-[#222222] group-hover:underline">
                        {item.product_name}
                      </h3>
                      <p className="mt-1 truncate text-sm text-muted">
                        {item.store_name}
                      </p>
                    </div>

                    <span className="shrink-0 text-sm font-semibold">
                      {formatDistance(item.distance_meters)}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {item.product_description || "Sin descripcion"}
                  </p>

                  <div className="mt-2 text-sm text-muted">
                    <span>{item.category_name ?? "Sin categoria"}</span>
                    <span> · Stock {item.stock}</span>
                  </div>

                  <p className="mt-2 font-semibold text-[#222222]">
                    S/ {Number(item.price).toFixed(2)}
                  </p>
                </article>
              ))}
            </div>
          ) : nearbyStores.length === 0 && !loadingStores ? (
            <div className="rounded-3xl border border-[#e5e7eb] bg-[#f7f7f7] p-6 text-sm text-muted">
              No encontramos tiendas activas en este radio. Prueba ampliarlo o
              vuelve a intentar tu ubicacion.
            </div>
          ) : (
            <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
              {nearbyStores.map((store) => (
                <article
                  key={store.store_id}
                  onMouseEnter={() => setSelectedStoreId(store.store_id)}
                  onClick={() => router.push(storeHref(store.store_id))}
                  className="group cursor-pointer"
                >
                  <StoreImage
                    src={store.image_url}
                    alt={store.store_name}
                    className="h-64"
                  />

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-[#222222] group-hover:underline">
                        {store.store_name}
                      </h3>
                      <p className="mt-1 truncate text-sm text-muted">
                        {store.address_text}
                      </p>
                    </div>

                    <span className="shrink-0 text-sm font-semibold">
                      {formatDistance(store.distance_meters)}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {store.description || "Tienda disponible cerca de ti."}
                  </p>

                  <p className="mt-2 text-xs text-muted">
                    Horario: {formatOpeningHours(store.opening_hours)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {store.categories.slice(0, 3).map((category) => (
                      <span
                        key={category.category_id ?? UNCATEGORIZED_ID}
                        className="rounded-full bg-[#f7f7f7] px-3 py-1 text-xs font-medium text-[#222222]"
                      >
                        {category.category_name}
                      </span>
                    ))}
                    {store.product_count === 0 && (
                      <span className="rounded-full bg-[#f7f7f7] px-3 py-1 text-xs font-medium text-muted">
                        Sin productos aun
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="order-first h-[360px] px-4 pb-4 sm:px-6 lg:sticky lg:top-16 lg:order-none lg:h-[calc(100vh-4rem)] lg:px-0 lg:pb-0">
          {userLat !== null && userLng !== null ? (
            <SearchMap
              userLat={userLat}
              userLng={userLng}
              results={results}
              stores={nearbyStores}
              selectedStoreId={selectedStoreId}
              selectedResultId={selectedResultId}
              onSelectStore={(store) => router.push(storeHref(store.store_id))}
              onSelectResult={(result) =>
                router.push(storeHref(result.store_id, result.store_product_id))
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-3xl bg-[#f7f7f7] p-6 text-center text-sm text-muted">
              El mapa aparecera cuando aceptes compartir tu ubicacion.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
