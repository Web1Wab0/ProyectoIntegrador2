"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  ChevronDown,
  Clock,
  LocateFixed,
  MapPinOff,
  PackageSearch,
  Search,
  Store,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import {
  normalizeOpeningHours,
  type StoreOpeningHours,
} from "../lib/store-hours";
import Notice from "../components/notice";
import StoreHoursDisplay from "../components/store-hours-display";
import FavoriteButton from "../components/favorite-button";
import RatingSummary from "../components/rating-summary";
import EmptyState from "../components/empty-state";
import { SkeletonGrid } from "../components/skeleton-card";
import { useSearchHistory } from "../lib/use-search-history";

const SearchMap = dynamic(() => import("../components/search-map"), {
  ssr: false,
});

const UNCATEGORIZED_ID = "uncategorized";
const NEARBY_STORES_TIMEOUT_MS = 12000;
const RADIUS_OPTIONS = [
  { value: "1000", label: "1 km" },
  { value: "3000", label: "3 km" },
  { value: "5000", label: "5 km" },
  { value: "10000", label: "10 km" },
];

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

function RadiusDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion() === true;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selected = RADIUS_OPTIONS.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-2 rounded-lg bg-[#f7f7f7] px-4 text-sm font-semibold outline-none transition hover:bg-[var(--surface-high)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        aria-expanded={open}
      >
        <span>{selected?.label ?? "3 km"}</span>
        <ChevronDown
          size={16}
          className={`transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="surface-popover absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl p-1"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.75 }}
          >
            {RADIUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-[var(--surface-high)] ${
                  option.value === value ? "text-[var(--primary)]" : ""
                }`}
              >
                {option.label}
                {option.value === value ? <span aria-hidden="true">•</span> : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function StoreImage({
  src,
  alt,
  className = "h-56",
  fit = "cover",
}: {
  src: string | null;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  return (
    <div
      className={`${className} listing-card-media ${
        fit === "cover" ? "listing-card-media-cover" : ""
      } relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[#eef1f4]`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className={fit === "contain" ? "object-contain p-3" : "object-cover"}
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
  const { history, addSearch } = useSearchHistory();
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
  const [searchFocused, setSearchFocused] = useState(false);
  const [storeRatings, setStoreRatings] = useState<
    Record<string, { average: number; count: number }>
  >({});
  const [productRatings, setProductRatings] = useState<
    Record<string, { average: number; count: number }>
  >({});

  const isSearchMode = lastSearch.trim().length > 0;

  useEffect(() => {
    const storeIds = Array.from(
      new Set([
        ...nearbyStores.map((item) => item.store_id),
        ...results.map((item) => item.store_id),
      ])
    );
    const productIds = results.map((item) => item.store_product_id);
    if (!storeIds.length && !productIds.length) return;

    void (async () => {
      const storeResponse = storeIds.length
        ? await supabase
            .from("store_review_summaries")
            .select("store_id, rating_average, review_count")
            .in("store_id", storeIds)
        : { data: [] };
      const productResponse = productIds.length
        ? await supabase
            .from("product_review_summaries")
            .select("store_product_id, rating_average, review_count")
            .in("store_product_id", productIds)
        : { data: [] };

      const nextStores: Record<string, { average: number; count: number }> = {};
      (storeResponse.data ?? []).forEach((row) => {
        nextStores[row.store_id] = {
          average: Number(row.rating_average ?? 0),
          count: Number(row.review_count ?? 0),
        };
      });
      const nextProducts: Record<string, { average: number; count: number }> = {};
      (productResponse.data ?? []).forEach((row) => {
        nextProducts[row.store_product_id] = {
          average: Number(row.rating_average ?? 0),
          count: Number(row.review_count ?? 0),
        };
      });
      setStoreRatings(nextStores);
      setProductRatings(nextProducts);
    })();
  }, [nearbyStores, results, supabase]);

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

  async function runSearch(term: string) {
    const query = term.trim();

    if (!query) {
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

    setLastSearch(query);
    setResults([]);
    setSelectedResultId(null);
    setSelectedStoreId(null);
    setSearching(true);
    setNotice(null);

    const { data, error } = await supabase.rpc("search_nearby_products", {
      p_search: query,
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
    setSelectedResultId(rows[0]?.store_product_id ?? null);
    setSelectedStoreId(rows[0]?.store_id ?? null);
    addSearch(query);
    setSearching(false);

    if (rows.length === 0) {
      setNotice({
        type: "warning",
        message: "No se encontraron productos cercanos para esa busqueda.",
      });
    }
  }

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runSearch(search);
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
          <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end">
            <div className="min-w-0">
              <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-high)] px-3 py-1.5 text-xs font-semibold text-muted">
                <LocateFixed size={13} className="text-[var(--primary)]" />
                <span className="truncate">
                  {userLat !== null && userLng !== null
                    ? "Ubicación activa"
                    : "Ubicación pendiente"}{" "}
                  · radio {Number(radius) / 1000} km
                </span>
              </div>
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
              <LocateFixed size={18} />
              {loadingLocation
                ? "Detectando ubicacion..."
                : locationAttempted
                ? "Reintentar ubicacion"
                : "Usar mi ubicacion"}
            </button>
          </div>

          <form
            onSubmit={handleSearch}
            className="grid gap-2 rounded-xl border border-[var(--border)] bg-white p-2 shadow-sm md:grid-cols-[1fr_150px_120px_auto]"
          >
            <div className="relative min-w-0">
              <input
                type="text"
                placeholder="Busca arroz, leche, gaseosa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() =>
                  window.setTimeout(() => setSearchFocused(false), 120)
                }
                className="min-h-12 w-full rounded-lg px-4 text-sm outline-none focus:bg-[var(--surface-high)]"
              />
              {searchFocused && history.length > 0 && (
                <div className="motion-pop surface-popover absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl p-2">
                  <p className="px-3 py-2 text-xs font-semibold uppercase text-muted">
                    Búsquedas recientes
                  </p>
                  {history.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSearch(term);
                        setSearchFocused(false);
                        void runSearch(term);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-high)]"
                    >
                      <Clock size={15} className="text-[var(--primary)]" />
                      <span className="min-w-0 truncate">{term}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <RadiusDropdown value={radius} onChange={setRadius} />

            <button
              type="submit"
              disabled={searching}
              className="btn-primary min-h-12 disabled:opacity-60"
            >
              <Search size={18} />
              {searching ? "Buscando" : "Buscar"}
            </button>

            {isSearchMode && (
              <button
                type="button"
                onClick={clearSearch}
                className="btn-soft min-h-12"
              >
                <X size={18} />
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
            <EmptyState
              icon={MapPinOff}
              title="Activa tu ubicación"
              description="Acepta el permiso del navegador para ver tiendas cercanas y comparar productos en el mapa."
              action={{
                label: "Usar mi ubicación",
                onClick: requestUserLocation,
              }}
              className="mt-4"
            />
          ) : searching && isSearchMode ? (
            <SkeletonGrid count={4} imageHeightClass="h-64" />
          ) : isSearchMode && results.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Sin productos cercanos"
              description="No encontramos productos para esa búsqueda en el radio actual. Prueba otro término o vuelve a explorar tiendas."
              action={{ label: "Ver tiendas", onClick: clearSearch }}
              className="mt-4"
            />
          ) : isSearchMode ? (
            <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
              {results.map((item) => (
                <article
                  key={item.store_product_id}
                  onMouseEnter={() => {
                    setSelectedResultId(item.store_product_id);
                    setSelectedStoreId(item.store_id);
                  }}
                  className="listing-card group relative cursor-pointer rounded-xl border border-transparent p-1"
                  onClick={() =>
                    router.push(storeHref(item.store_id, item.store_product_id))
                  }
                >
                  <StoreImage
                    src={item.image_url}
                    alt={item.product_name}
                    className="h-64"
                    fit="contain"
                  />
                  <FavoriteButton
                    kind="product"
                    id={item.store_product_id}
                    storeId={item.store_id}
                    className="absolute right-3 top-3 z-10"
                  />

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-[var(--on-surface)] group-hover:text-[var(--primary)]">
                        {item.product_name}
                      </h3>
                      <p className="mt-1 truncate text-sm text-muted">
                        {item.store_name}
                      </p>
                      <RatingSummary
                        average={productRatings[item.store_product_id]?.average ?? 0}
                        count={productRatings[item.store_product_id]?.count ?? 0}
                        compact
                      />
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

                  <p className="mt-2 font-semibold text-[var(--on-surface)]">
                    S/ {Number(item.price).toFixed(2)}
                  </p>
                </article>
              ))}
            </div>
          ) : loadingStores ? (
            <SkeletonGrid count={4} imageHeightClass="h-64" />
          ) : nearbyStores.length === 0 ? (
            <EmptyState
              icon={Store}
              title="Sin tiendas en este radio"
              description="No encontramos tiendas activas cerca de tu ubicación. Puedes ampliar el radio o reintentar la ubicación."
              action={{
                label: "Ampliar radio",
                onClick: () => setRadius("10000"),
              }}
              className="mt-4"
            />
          ) : (
            <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
              {nearbyStores.map((store) => (
                <article
                  key={store.store_id}
                  onMouseEnter={() => setSelectedStoreId(store.store_id)}
                  onClick={() => router.push(storeHref(store.store_id))}
                  className="listing-card group relative cursor-pointer rounded-xl border border-transparent p-1"
                >
                  <StoreImage
                    src={store.image_url}
                    alt={store.store_name}
                    className="h-64"
                  />
                  <FavoriteButton
                    kind="store"
                    id={store.store_id}
                    storeId={store.store_id}
                    className="absolute right-3 top-3 z-10"
                  />

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-[var(--on-surface)] group-hover:text-[var(--primary)]">
                        {store.store_name}
                      </h3>
                      <p className="mt-1 truncate text-sm text-muted">
                        {store.address_text}
                      </p>
                      <RatingSummary
                        average={storeRatings[store.store_id]?.average ?? 0}
                        count={storeRatings[store.store_id]?.count ?? 0}
                        compact
                      />
                    </div>

                    <span className="shrink-0 text-sm font-semibold">
                      {formatDistance(store.distance_meters)}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm text-muted">
                    {store.description || "Tienda disponible cerca de ti."}
                  </p>

                  <StoreHoursDisplay
                    hours={store.opening_hours}
                    compact
                    className="mt-3"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    {store.categories.slice(0, 3).map((category) => (
                      <span
                        key={category.category_id ?? UNCATEGORIZED_ID}
                        className="rounded-full bg-[#f2ecff] px-3 py-1 text-xs font-medium text-[var(--primary)]"
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
              onSelectStore={(store) => setSelectedStoreId(store.store_id)}
              onSelectResult={(result) => {
                setSelectedStoreId(result.store_id);
                setSelectedResultId(result.store_product_id);
              }}
              onOpenStore={(store) => router.push(storeHref(store.store_id))}
              onOpenResult={(result) =>
                router.push(storeHref(result.store_id, result.store_product_id))
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-[var(--border)] bg-[#f7f7f7] p-6 text-center text-sm text-muted">
              <div>
                <Store className="mx-auto mb-3 text-[var(--primary)]" />
                El mapa aparecerá cuando aceptes compartir tu ubicación.
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
