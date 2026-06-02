"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase/client";
import {
  formatOpeningHours,
  getAvailablePickupSlots,
  getOpeningDayForDate,
  getTodayDateInput,
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
  address_text: string;
  district: string | null;
  latitude: number;
  longitude: number;
  distance_meters: number;
  product_count: number;
  categories: StoreCategory[];
  opening_hours: StoreOpeningHours;
};

type StoreCatalogItem = {
  id: string;
  price: number;
  stock: number;
  image_url: string | null;
  is_available: boolean;
  product: {
    id: string;
    product_name: string;
    description: string | null;
    brand: string | null;
    category_id: string | null;
    category_name: string;
  } | null;
};

type CartItem = {
  store_product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  stock: number;
};

type MaybeArray<T> = T | T[] | null;

type StoreCatalogCategory = {
  id: string;
  name: string;
};

type RawStoreCatalogProduct = {
  id: string;
  product_name: string;
  description: string | null;
  brand: string | null;
  category_id: string | null;
  category: MaybeArray<StoreCatalogCategory>;
};

type RawStoreCatalogItem = Omit<StoreCatalogItem, "product"> & {
  product: MaybeArray<RawStoreCatalogProduct>;
};

type RawNearbyStore = Omit<
  NearbyStore,
  "categories" | "product_count"
> & {
  product_count: number | string | null;
  categories: unknown;
  opening_hours?: unknown;
};

type RawFallbackProduct = {
  category_id: string | null;
  categories: MaybeArray<StoreCatalogCategory>;
};

type RawFallbackStoreProduct = {
  id: string;
  products: MaybeArray<RawFallbackProduct>;
};

type RawFallbackStore = {
  id: string;
  store_name: string;
  address_text: string;
  district: string | null;
  latitude: number;
  longitude: number;
  store_products: RawFallbackStoreProduct[] | null;
};

type RawSearchResult = Omit<SearchResult, "opening_hours"> & {
  opening_hours?: unknown;
};

type SupabaseQueryResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

function firstOrNull<T>(value: MaybeArray<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeStoreCatalogItem(
  item: RawStoreCatalogItem
): StoreCatalogItem {
  const product = firstOrNull(item.product);
  const category = firstOrNull(product?.category);

  return {
    ...item,
    product: product
      ? {
          id: product.id,
          product_name: product.product_name,
          description: product.description,
          brand: product.brand,
          category_id: category?.id ?? product.category_id ?? null,
          category_name: category?.name ?? "Sin categoria",
        }
      : null,
  };
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
  const [radius, setRadius] = useState("3000");
  const [quantityById, setQuantityById] = useState<Record<string, number>>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [nearbyStores, setNearbyStores] = useState<NearbyStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationAttempted, setLocationAttempted] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [searching, setSearching] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [cartStoreId, setCartStoreId] = useState<string | null>(null);
  const [cartStoreName, setCartStoreName] = useState("");
  const [cartStoreAddress, setCartStoreAddress] = useState("");
  const [cartStoreOpeningHours, setCartStoreOpeningHours] =
    useState<StoreOpeningHours>(() => normalizeOpeningHours(null));
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [pickupDate, setPickupDate] = useState(() => getTodayDateInput());
  const [pickupTime, setPickupTime] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");
  const [storeCatalog, setStoreCatalog] = useState<StoreCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [creatingReservation, setCreatingReservation] = useState(false);

  const applySessionUser = useCallback((user: User | null) => {
    if (!user) {
      setCurrentUserId(null);
      setCurrentRole(null);
      setAuthLoading(false);
      return;
    }

    setCurrentUserId(user.id);
    setCurrentRole(
      typeof user.user_metadata?.role === "string"
        ? user.user_metadata.role
        : null
    );
    setAuthLoading(false);
  }, []);

  const loadRoleForUser = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (error) return null;

      return typeof data?.role === "string" ? data.role : null;
    },
    [supabase]
  );

  useEffect(() => {
    let mounted = true;
    let roleTimer: number | null = null;

    function scheduleRoleLoad(user: User) {
      if (roleTimer) window.clearTimeout(roleTimer);

      roleTimer = window.setTimeout(async () => {
        const role = await loadRoleForUser(user.id);

        if (!mounted || !role) return;

        setCurrentRole(role);
      }, 0);
    }

    async function loadSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        const user = session?.user ?? null;
        applySessionUser(user);

        if (user) scheduleRoleLoad(user);
      } catch {
        if (!mounted) return;

        setCurrentUserId(null);
        setCurrentRole(null);
        setAuthLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const user = session?.user ?? null;
      applySessionUser(user);

      if (user) scheduleRoleLoad(user);
    });

    return () => {
      mounted = false;
      if (roleTimer) window.clearTimeout(roleTimer);
      subscription.unsubscribe();
    };
  }, [applySessionUser, loadRoleForUser, supabase]);

  const loadNearbyStoresFallback = useCallback(
    async (lat: number, lng: number, signal: AbortSignal) => {
      const { data, error } = await supabase
        .from("stores")
        .select(`
          id,
          store_name,
          address_text,
          district,
          latitude,
          longitude,
          store_products (
            id,
            products:product_id (
              category_id,
              categories:category_id (
                id,
                name
              )
            )
          )
        `)
        .eq("is_active", true)
        .eq("status", "active")
        .abortSignal(signal);

      if (error) throw new Error(error.message);

      return ((data as RawFallbackStore[]) ?? [])
        .map((store) => {
          const storeProducts = store.store_products ?? [];
          const distance = distanceInMeters(
            lat,
            lng,
            Number(store.latitude),
            Number(store.longitude)
          );

          if (storeProducts.length === 0 || distance > Number(radius)) {
            return null;
          }

          const categoriesByKey = new Map<string, StoreCategory>();

          storeProducts.forEach((storeProduct) => {
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
            address_text: store.address_text,
            district: store.district,
            latitude: Number(store.latitude),
            longitude: Number(store.longitude),
            distance_meters: distance,
            product_count: storeProducts.length,
            opening_hours: normalizeOpeningHours(null),
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
        } catch (error) {
          if (controller.signal.aborted) {
            throw new Error(
              "La carga de tiendas tardo demasiado. Intenta nuevamente."
            );
          }

          throw error;
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

  const selectedNearbyStore = useMemo(
    () => nearbyStores.find((store) => store.store_id === selectedStoreId),
    [nearbyStores, selectedStoreId]
  );

  const catalogCategories = useMemo(() => {
    const categoriesByKey = new Map<string, StoreCategory>();

    storeCatalog.forEach((item) => {
      if (!item.product) return;

      const key = item.product.category_id ?? UNCATEGORIZED_ID;
      const current = categoriesByKey.get(key);

      categoriesByKey.set(key, {
        category_id: item.product.category_id,
        category_name:
          item.product.category_name ||
          current?.category_name ||
          "Sin categoria",
        product_count: (current?.product_count ?? 0) + 1,
      });
    });

    return Array.from(categoriesByKey.values()).sort((a, b) =>
      a.category_name.localeCompare(b.category_name)
    );
  }, [storeCatalog]);

  const filteredStoreCatalog = useMemo(() => {
    if (activeCategoryId === "all") return storeCatalog;

    return storeCatalog.filter((item) => {
      const itemCategoryId = item.product?.category_id ?? UNCATEGORIZED_ID;
      return itemCategoryId === activeCategoryId;
    });
  }, [activeCategoryId, storeCatalog]);

  const pickupSlots = useMemo(
    () => getAvailablePickupSlots(pickupDate, cartStoreOpeningHours),
    [cartStoreOpeningHours, pickupDate]
  );

  const selectedPickupDay = useMemo(
    () => getOpeningDayForDate(pickupDate, cartStoreOpeningHours),
    [cartStoreOpeningHours, pickupDate]
  );

  const pickupAt = useMemo(() => {
    if (!pickupDate || !pickupTime) return "";
    return `${pickupDate}T${pickupTime}`;
  }, [pickupDate, pickupTime]);

  useEffect(() => {
    if (!pickupTime) return;

    const isValidSlot = pickupSlots.some((slot) => slot.value === pickupTime);

    if (!isValidSlot) {
      setPickupTime("");
    }
  }, [pickupSlots, pickupTime]);

  function clearCart() {
    setCartStoreId(null);
    setCartStoreName("");
    setCartStoreAddress("");
    setCartStoreOpeningHours(normalizeOpeningHours(null));
    setCartItems([]);
    setPickupDate(getTodayDateInput());
    setPickupTime("");
    setReservationNotes("");
    setStoreCatalog([]);
    setSelectedStoreId(null);
    setActiveCategoryId("all");
  }

  async function loadStoreCatalog(storeId: string) {
    setLoadingCatalog(true);
    setActiveCategoryId("all");

    const { data, error } = await supabase
      .from("store_products")
      .select(`
        id,
        price,
        stock,
        image_url,
        is_available,
        product:products!store_products_product_id_fkey (
          id,
          product_name,
          description,
          brand,
          category_id,
          category:categories!products_category_id_fkey (
            id,
            name
          )
        )
      `)
      .eq("store_id", storeId)
      .eq("is_available", true)
      .gt("stock", 0)
      .order("created_at", { ascending: false });

    if (error) {
      setNotice({ type: "error", message: error.message });
      setLoadingCatalog(false);
      return;
    }

    setStoreCatalog(((data as RawStoreCatalogItem[]) ?? []).map(normalizeStoreCatalogItem));
    setLoadingCatalog(false);
  }

  async function prepareCartStore(
    storeId: string,
    storeName: string,
    storeAddress: string,
    openingHours: StoreOpeningHours
  ) {
    if (cartStoreId && cartStoreId !== storeId) {
      const confirmed = window.confirm(
        "Tu reserva actual pertenece a otro local. Deseas vaciarla y cambiar de tienda?"
      );

      if (!confirmed) return false;

      clearCart();
    }

    setSelectedStoreId(storeId);
    setCartStoreOpeningHours(openingHours);

    if (cartStoreId !== storeId) {
      setCartStoreId(storeId);
      setCartStoreName(storeName);
      setCartStoreAddress(storeAddress);
      setCartStoreOpeningHours(openingHours);
      setPickupDate(getTodayDateInput());
      setPickupTime("");
      await loadStoreCatalog(storeId);
    } else if (storeCatalog.length === 0) {
      await loadStoreCatalog(storeId);
    }

    return true;
  }

  async function handleSelectStore(store: NearbyStore) {
    const ok = await prepareCartStore(
      store.store_id,
      store.store_name,
      store.address_text,
      store.opening_hours
    );

    if (!ok) return;

    setNotice({
      type: "success",
      message: `Viendo productos de ${store.store_name}.`,
    });
  }

  function addItemToCart(item: CartItem) {
    setCartItems((prev) => {
      const existing = prev.find(
        (x) => x.store_product_id === item.store_product_id
      );

      if (!existing) {
        return [...prev, item];
      }

      const nextQty = existing.quantity + item.quantity;

      if (nextQty > item.stock) {
        setNotice({
          type: "warning",
          message: `No puedes agregar mas de ${item.stock} unidades de ${item.product_name}.`,
        });
        return prev;
      }

      return prev.map((x) =>
        x.store_product_id === item.store_product_id
          ? { ...x, quantity: nextQty }
          : x
      );
    });
  }

  async function handleAddSearchResult(item: SearchResult) {
    const ok = await prepareCartStore(
      item.store_id,
      item.store_name,
      item.address_text,
      item.opening_hours
    );

    if (!ok) return;

    const qty = quantityById[item.store_product_id] ?? 1;

    if (qty <= 0 || qty > item.stock) {
      setNotice({
        type: "warning",
        message: `La cantidad debe estar entre 1 y ${item.stock}.`,
      });
      return;
    }

    addItemToCart({
      store_product_id: item.store_product_id,
      product_name: item.product_name,
      price: item.price,
      quantity: qty,
      image_url: item.image_url,
      stock: item.stock,
    });

    setNotice({
      type: "success",
      message: `${item.product_name} fue agregado a tu reserva.`,
    });
  }

  async function handleAddCatalogItem(item: StoreCatalogItem) {
    if (!cartStoreId || !item.product) return;

    const qty = quantityById[item.id] ?? 1;

    if (qty <= 0 || qty > item.stock) {
      setNotice({
        type: "warning",
        message: `La cantidad debe estar entre 1 y ${item.stock}.`,
      });
      return;
    }

    addItemToCart({
      store_product_id: item.id,
      product_name: item.product.product_name,
      price: item.price,
      quantity: qty,
      image_url: item.image_url,
      stock: item.stock,
    });

    setNotice({
      type: "success",
      message: `${item.product.product_name} fue agregado a tu reserva.`,
    });
  }

  function updateCartItemQuantity(storeProductId: string, quantity: number) {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.store_product_id !== storeProductId) return item;
        const safeQty = Math.max(1, Math.min(quantity, item.stock));
        return { ...item, quantity: safeQty };
      })
    );
  }

  function removeCartItem(storeProductId: string) {
    setCartItems((prev) =>
      prev.filter((item) => item.store_product_id !== storeProductId)
    );
  }

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!search.trim()) {
      setNotice({
        type: "warning",
        message: "Escribe un producto para buscar.",
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
    setSearching(false);

    if (rows.length === 0) {
      setNotice({
        type: "warning",
        message: "No se encontraron productos cercanos para esa busqueda.",
      });
    } else {
      setNotice({
        type: "success",
        message: `Se encontraron ${rows.length} productos cercanos.`,
      });
    }
  }

  async function handleCreateReservation() {
    if (authLoading) return;

    if (!cartStoreId || cartItems.length === 0) {
      setNotice({
        type: "warning",
        message: "Primero agrega productos a tu reserva.",
      });
      return;
    }

    if (!pickupDate || !pickupTime || !pickupAt) {
      setNotice({
        type: "warning",
        message: "Debes elegir una fecha y hora de recojo disponible.",
      });
      return;
    }

    if (!pickupSlots.some((slot) => slot.value === pickupTime)) {
      setNotice({
        type: "warning",
        message: "La tienda esta cerrada en ese horario. Elige otra hora.",
      });
      return;
    }

    if (!currentUserId) {
      setNotice({
        type: "warning",
        message: "Debes iniciar sesion como cliente para reservar.",
      });
      router.push("/auth/sign-in?next=/");
      return;
    }

    if (currentRole !== "customer") {
      setNotice({
        type: "warning",
        message: "Solo las cuentas de cliente pueden confirmar reservas.",
      });
      return;
    }

    setCreatingReservation(true);

    const { error } = await supabase.rpc("create_reservation_with_items", {
      p_store_id: cartStoreId,
      p_items: cartItems.map((item) => ({
        store_product_id: item.store_product_id,
        quantity: item.quantity,
      })),
      p_pickup_at: new Date(pickupAt).toISOString(),
      p_notes: reservationNotes || null,
    });

    if (error) {
      setCreatingReservation(false);
      setNotice({
        type: "error",
        message: error.message,
      });
      return;
    }

    clearCart();
    setCreatingReservation(false);

    setNotice({
      type: "success",
      message: "Reserva creada correctamente. Te llevaremos a Mis reservas...",
    });

    setTimeout(() => {
      window.location.replace("/customer/reservations");
    }, 1200);
  }

  const cartTotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  return (
    <main className="app-page px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="mb-4 flex justify-end">
          <AuthAccessMenu />
        </div>

        <div className="rounded-2xl app-card p-6 shadow-lg">
          <h1 className="page-title text-4xl">
            Buscar productos cercanos
          </h1>
          <p className="mt-3 text-base text-muted">
            Al ingresar, AhorraPe intenta detectar tu ubicacion para mostrarte
            tiendas cercanas. Luego puedes elegir una tienda o buscar un producto.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={requestUserLocation}
              disabled={loadingLocation}
              className="btn-secondary"
            >
              {loadingLocation
                ? "Detectando ubicacion..."
                : locationAttempted
                ? "Reintentar ubicacion"
                : "Usar mi ubicacion"}
            </button>

            {userLat !== null && userLng !== null && (
              <div className="rounded-2xl app-card-soft px-4 py-3 text-sm text-muted">
                Lat: {userLat.toFixed(6)} | Lng: {userLng.toFixed(6)}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSearch}
            className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_160px]"
          >
            <input
              type="text"
              placeholder="Ejemplo: coca cola, arroz, leche"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="app-input"
            />

            <select
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="app-input"
            >
              <option value="1000">1 km</option>
              <option value="3000">3 km</option>
              <option value="5000">5 km</option>
              <option value="10000">10 km</option>
            </select>

            <button
              type="submit"
              disabled={searching}
              className="btn-secondary"
            >
              {searching ? "Buscando..." : "Buscar"}
            </button>
          </form>

          <div className="info-box mt-4">
            Puedes explorar tiendas sin buscar un producto. Para confirmar una
            reserva, debes iniciar sesion con una cuenta de cliente.
          </div>

          {notice && (
            <div className="mt-4">
              <Notice type={notice.type} message={notice.message} />
            </div>
          )}
        </div>

        {userLat !== null && userLng !== null && (
          <div className="rounded-2xl app-card p-4 shadow-lg">
            <SearchMap
              userLat={userLat}
              userLng={userLng}
              results={results}
              stores={nearbyStores}
              selectedStoreId={selectedStoreId}
              onSelectStore={handleSelectStore}
            />
          </div>
        )}

        {userLat !== null && userLng !== null && (
          <section className="rounded-2xl app-card p-6 shadow-lg">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="section-title text-2xl">Tiendas cercanas</h2>
                <p className="mt-2 text-sm text-muted">
                  Radio actual: {Number(radius) / 1000} km. Selecciona una
                  tienda para ver sus productos por categoria.
                </p>
              </div>

              {loadingStores && (
                <div className="app-card-soft rounded-2xl px-4 py-3 text-sm text-muted">
                  Cargando tiendas...
                </div>
              )}
            </div>

            {!loadingStores && nearbyStores.length === 0 ? (
              <div className="info-box mt-4">
                No encontramos tiendas activas con productos disponibles en este
                radio.
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {nearbyStores.map((store) => (
                  <article
                    key={store.store_id}
                    className={`app-card-soft cursor-pointer p-5 transition ${
                      selectedStoreId === store.store_id
                        ? "ring-2 ring-[var(--primary)]"
                        : ""
                    }`}
                    onClick={() => handleSelectStore(store)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="section-title text-xl">
                          {store.store_name}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                          {store.address_text}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {formatDistance(store.distance_meters)}
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-muted">
                      {store.product_count} productos disponibles
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      Horario: {formatOpeningHours(store.opening_hours)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {store.categories.slice(0, 4).map((category) => (
                        <span
                          key={category.category_id ?? UNCATEGORIZED_ID}
                          className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[var(--on-surface)]"
                        >
                          {category.category_name}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {cartStoreId && (
          <div className="rounded-2xl app-card p-6 shadow-lg">
            <h2 className="text-2xl font-bold">Mi reserva</h2>
            <p className="mt-2 text-muted">
              Local seleccionado:{" "}
              <span className="font-semibold text-white">{cartStoreName}</span>
            </p>
            <p className="text-sm text-muted">{cartStoreAddress}</p>
            <p className="mt-1 text-xs text-muted">
              Horario: {formatOpeningHours(cartStoreOpeningHours)}
            </p>

            {cartItems.length === 0 ? (
              <div className="mt-4 rounded-xl app-card-soft p-4 text-gray-300">
                Todavia no agregaste productos.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={item.store_product_id}
                    className="rounded-xl app-card-soft p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">{item.product_name}</p>
                        <p className="text-sm text-muted">
                          S/ {Number(item.price).toFixed(2)} c/u
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartItemQuantity(
                              item.store_product_id,
                              Number(e.target.value)
                            )
                          }
                          className="w-24 rounded-2xl bg-[#eef2f7] px-3 py-2 text-[var(--on-surface)] outline-none"
                        />

                        <button
                          onClick={() => removeCartItem(item.store_product_id)}
                          className="btn-danger"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm text-muted">
                  Fecha de recojo
                </label>
                <input
                  type="date"
                  value={pickupDate}
                  min={getTodayDateInput()}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 app-card-soft px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted">
                  Hora disponible
                </label>
                <select
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  disabled={pickupSlots.length === 0}
                  className="w-full rounded-xl border border-gray-700 app-card-soft px-4 py-3 outline-none disabled:opacity-60"
                >
                  <option value="">
                    {pickupSlots.length === 0
                      ? "Sin horarios disponibles"
                      : "Selecciona una hora"}
                  </option>
                  {pickupSlots.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
                {selectedPickupDay?.closed || pickupSlots.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    La tienda no atiende en la fecha seleccionada o ya no hay
                    horas futuras disponibles.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted">
                  Nota opcional
                </label>
                <input
                  type="text"
                  value={reservationNotes}
                  onChange={(e) => setReservationNotes(e.target.value)}
                  placeholder="Ejemplo: pasare despues del trabajo"
                  className="w-full rounded-xl border border-gray-700 app-card-soft px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-lg font-semibold">
                Total: S/ {cartTotal.toFixed(2)}
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={clearCart}
                  className="rounded-lg bg-gray-700 px-4 py-3 font-semibold hover:bg-gray-600"
                >
                  Vaciar reserva
                </button>

                <button
                  onClick={handleCreateReservation}
                  disabled={creatingReservation}
                  className="rounded-lg bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {creatingReservation
                    ? "Confirmando..."
                    : !currentUserId
                    ? "Inicia sesion para confirmar"
                    : currentRole !== "customer"
                    ? "Solo cliente puede confirmar"
                    : "Confirmar reserva"}
                </button>
              </div>
            </div>
          </div>
        )}

        {cartStoreId && (
          <div className="rounded-2xl app-card p-6 shadow-lg">
            <h2 className="text-2xl font-bold">
              Productos de {cartStoreName || selectedNearbyStore?.store_name}
            </h2>
            <p className="mt-2 text-muted">
              Elige una categoria o agrega varios productos de esta misma tienda
              a tu reserva.
            </p>

            {loadingCatalog ? (
              <div className="mt-4 rounded-xl app-card-soft p-4 text-gray-300">
                Cargando productos del local...
              </div>
            ) : storeCatalog.length === 0 ? (
              <div className="mt-4 rounded-xl app-card-soft p-4 text-gray-300">
                No hay productos disponibles en esta tienda.
              </div>
            ) : (
              <>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCategoryId("all")}
                    className={
                      activeCategoryId === "all" ? "btn-primary" : "btn-soft"
                    }
                  >
                    Todos ({storeCatalog.length})
                  </button>

                  {catalogCategories.map((category) => {
                    const key = category.category_id ?? UNCATEGORIZED_ID;

                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setActiveCategoryId(key)}
                        className={
                          activeCategoryId === key ? "btn-primary" : "btn-soft"
                        }
                      >
                        {category.category_name} ({category.product_count})
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredStoreCatalog.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl app-card-soft p-4"
                    >
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.product?.product_name ?? "Producto"}
                          width={400}
                          height={220}
                          className="mb-4 h-40 w-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="mb-4 flex h-40 items-center justify-center rounded-lg bg-gray-700 text-gray-300">
                          Sin imagen
                        </div>
                      )}

                      <h3 className="text-lg font-semibold">
                        {item.product?.product_name || "Producto"}
                      </h3>

                      <p className="mt-1 text-xs font-semibold uppercase text-emerald-500">
                        {item.product?.category_name ?? "Sin categoria"}
                      </p>

                      <p className="mt-2 text-sm text-gray-300">
                        {item.product?.description || "Sin descripcion"}
                      </p>

                      <div className="mt-3 space-y-1 text-sm text-muted">
                        <p>Precio: S/ {Number(item.price).toFixed(2)}</p>
                        <p>Stock: {item.stock}</p>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          value={quantityById[item.id] ?? 1}
                          onChange={(e) =>
                            setQuantityById((prev) => ({
                              ...prev,
                              [item.id]: Number(e.target.value),
                            }))
                          }
                          className="w-24 rounded-2xl bg-[#eef2f7] px-3 py-2 text-[var(--on-surface)] outline-none"
                        />

                        <button
                          onClick={() => handleAddCatalogItem(item)}
                          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-700"
                        >
                          Agregar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="info-box">
            Se encontraron{" "}
            <span className="font-semibold text-[var(--on-surface)]">
              {results.length}
            </span>{" "}
            productos cerca de tu ubicacion.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((item) => (
            <article
              key={item.store_product_id}
              className="rounded-2xl app-card p-5 shadow-lg"
            >
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.product_name}
                  width={400}
                  height={220}
                  className="mb-4 h-48 w-full rounded-lg object-cover"
                />
              ) : (
                <div className="mb-4 flex h-48 items-center justify-center rounded-lg app-card-soft text-gray-300">
                  Sin imagen
                </div>
              )}

              <h2 className="section-title text-xl">{item.product_name}</h2>
              <p className="mt-2 text-sm text-muted">
                {item.product_description || "Sin descripcion"}
              </p>

              <div className="mt-3 space-y-1 text-sm text-muted">
                <p>Tienda: {item.store_name}</p>
                <p>Direccion: {item.address_text}</p>
                <p>Categoria: {item.category_name ?? "Sin categoria"}</p>
                <p>Precio: S/ {Number(item.price).toFixed(2)}</p>
                <p>Stock: {item.stock}</p>
                <p>Distancia: {formatDistance(item.distance_meters)}</p>
                <p>Horario: {formatOpeningHours(item.opening_hours)}</p>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  type="number"
                  min="1"
                  max={item.stock}
                  value={quantityById[item.store_product_id] ?? 1}
                  onChange={(e) =>
                    setQuantityById((prev) => ({
                      ...prev,
                      [item.store_product_id]: Number(e.target.value),
                    }))
                  }
                  className="w-24 rounded-2xl bg-[#eef2f7] px-3 py-2 text-[var(--on-surface)] outline-none"
                />

                <button
                  onClick={() => handleAddSearchResult(item)}
                  className="btn-primary flex-1 px-4 py-2"
                >
                  Agregar a mi reserva
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
