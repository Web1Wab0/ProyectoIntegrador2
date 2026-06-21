"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import {
  formatOpeningHours,
  getAvailablePickupSlots,
  getOpeningDayForDate,
  getTodayDateInput,
  normalizeOpeningHours,
  type StoreOpeningHours,
} from "../../../lib/store-hours";
import Notice from "../../../components/notice";

const UNCATEGORIZED_ID = "uncategorized";

type StoreDetails = {
  id: string;
  store_name: string;
  description: string | null;
  image_url: string | null;
  address_text: string;
  district: string | null;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
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

type RawStoreRow = Omit<StoreDetails, "opening_hours" | "image_url"> & {
  image_url?: string | null;
  opening_hours?: unknown;
};

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

type CatalogCategory = {
  category_id: string | null;
  category_name: string;
  product_count: number;
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

function normalizeStore(row: RawStoreRow): StoreDetails {
  return {
    ...row,
    image_url: row.image_url ?? null,
    opening_hours: normalizeOpeningHours(row.opening_hours),
  };
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false;

  return (
    error.code === "42703" ||
    error.message?.toLowerCase().includes("column") ||
    error.message?.toLowerCase().includes("schema cache")
  );
}

function categoryKey(categoryId: string | null) {
  return categoryId ?? UNCATEGORIZED_ID;
}

export default function StorePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams<{ storeId: string }>();
  const searchParams = useSearchParams();
  const highlightedProductId = searchParams.get("product");
  const highlightedRef = useRef<HTMLElement | null>(null);

  const storeId = params.storeId;

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [store, setStore] = useState<StoreDetails | null>(null);
  const [catalog, setCatalog] = useState<StoreCatalogItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [quantityById, setQuantityById] = useState<Record<string, number>>({});
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [pickupDate, setPickupDate] = useState(() => getTodayDateInput());
  const [pickupTime, setPickupTime] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");
  const [creatingReservation, setCreatingReservation] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const loadStore = useCallback(async () => {
    async function queryStore(includeImage: boolean) {
      return supabase
        .from("stores")
        .select(
          `
            id,
            store_name,
            description,
            ${includeImage ? "image_url," : ""}
            address_text,
            district,
            city,
            country,
            latitude,
            longitude,
            opening_hours
          `
        )
        .eq("id", storeId)
        .eq("is_active", true)
        .eq("status", "active")
        .maybeSingle<RawStoreRow>();
    }

    let { data, error } = await queryStore(true);

    if (error && isMissingColumnError(error)) {
      const fallback = await queryStore(false);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      setNotice({ type: "error", message: error.message });
      setLoading(false);
      return;
    }

    if (!data) {
      setNotice({
        type: "warning",
        message: "No encontramos esta tienda o no esta activa.",
      });
      setLoading(false);
      return;
    }

    setStore(normalizeStore(data));

    const { data: productsData, error: productsError } = await supabase
      .from("store_products")
      .select(
        `
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
        `
      )
      .eq("store_id", storeId)
      .eq("is_available", true)
      .gt("stock", 0)
      .order("created_at", { ascending: false });

    if (productsError) {
      setNotice({ type: "error", message: productsError.message });
      setLoading(false);
      return;
    }

    setCatalog(
      ((productsData as RawStoreCatalogItem[]) ?? []).map(
        normalizeStoreCatalogItem
      )
    );
    setLoading(false);
  }, [storeId, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStore();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadStore]);

  useEffect(() => {
    let mounted = true;
    let roleTimer: number | null = null;

    async function loadRole(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (typeof data?.role === "string") {
        setCurrentRole(data.role);
      }
    }

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      const user = session?.user ?? null;

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
      roleTimer = window.setTimeout(() => void loadRole(user.id), 0);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const user = session?.user ?? null;

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

      if (roleTimer) window.clearTimeout(roleTimer);
      roleTimer = window.setTimeout(() => void loadRole(user.id), 0);
    });

    return () => {
      mounted = false;
      if (roleTimer) window.clearTimeout(roleTimer);
      subscription.unsubscribe();
    };
  }, [supabase]);

  const catalogCategories = useMemo(() => {
    const categoriesByKey = new Map<string, CatalogCategory>();

    catalog.forEach((item) => {
      if (!item.product) return;

      const key = categoryKey(item.product.category_id);
      const current = categoriesByKey.get(key);

      categoriesByKey.set(key, {
        category_id: item.product.category_id,
        category_name:
          item.product.category_name ?? current?.category_name ?? "Sin categoria",
        product_count: (current?.product_count ?? 0) + 1,
      });
    });

    return Array.from(categoriesByKey.values()).sort((a, b) =>
      a.category_name.localeCompare(b.category_name)
    );
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (activeCategoryId === "all") return catalog;

    return catalog.filter(
      (item) =>
        item.product && categoryKey(item.product.category_id) === activeCategoryId
    );
  }, [activeCategoryId, catalog]);

  const selectedPickupDay = useMemo(() => {
    if (!store) return null;
    return getOpeningDayForDate(pickupDate, store.opening_hours);
  }, [pickupDate, store]);

  const pickupSlots = useMemo(() => {
    if (!store) return [];
    return getAvailablePickupSlots(pickupDate, store.opening_hours);
  }, [pickupDate, store]);

  const pickupAt = useMemo(() => {
    if (!pickupDate || !pickupTime) return "";
    return `${pickupDate}T${pickupTime}`;
  }, [pickupDate, pickupTime]);

  const cartTotal = cartItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  useEffect(() => {
    if (!pickupTime) return;

    const isValidSlot = pickupSlots.some((slot) => slot.value === pickupTime);

    if (!isValidSlot) {
      const timer = window.setTimeout(() => {
        setPickupTime("");
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [pickupSlots, pickupTime]);

  useEffect(() => {
    if (!highlightedProductId || !catalog.length) return;

    const highlighted = catalog.find((item) => item.id === highlightedProductId);

    if (!highlighted) return;

    const timer = window.setTimeout(() => {
      if (highlighted.product?.category_id) {
        setActiveCategoryId(categoryKey(highlighted.product.category_id));
      }

      highlightedRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [catalog, highlightedProductId]);

  function addItemToCart(item: CartItem) {
    setCartItems((prev) => {
      const existing = prev.find(
        (x) => x.store_product_id === item.store_product_id
      );

      if (!existing) return [...prev, item];

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

  function handleAddCatalogItem(item: StoreCatalogItem) {
    if (!item.product) return;

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

  function clearCart() {
    setCartItems([]);
    setPickupDate(getTodayDateInput());
    setPickupTime("");
    setReservationNotes("");
  }

  async function handleCreateReservation() {
    if (authLoading || !store) return;

    if (cartItems.length === 0) {
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
      router.push(`/auth/sign-in?next=/stores/${store.id}`);
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
      p_store_id: store.id,
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

    window.setTimeout(() => {
      window.location.replace("/customer/reservations");
    }, 1200);
  }

  if (loading) {
    return (
      <main className="app-page">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="skeleton h-8 w-40 rounded-lg" />
          <div className="skeleton h-[360px] rounded-xl" />
          <div className="grid gap-5 md:grid-cols-2">
            <div className="skeleton h-72 rounded-xl" />
            <div className="skeleton h-72 rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!store) {
    return (
      <main className="app-page">
        <div className="mx-auto max-w-3xl app-card p-6">
          {notice && <Notice type={notice.type} message={notice.message} />}
          <Link href="/" className="btn-soft mt-4">
            Volver al mapa
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[var(--on-surface)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center">
          <Link href="/" className="btn-soft">
            <ArrowLeft size={18} />
            Volver al mapa
          </Link>
        </div>

        {notice && (
          <div className="mb-5">
            <Notice type={notice.type} message={notice.message} />
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <div className="relative h-[260px] overflow-hidden rounded-xl border border-[var(--border)] bg-[#eef1f4] sm:h-[380px]">
              {store.image_url ? (
                <Image
                  src={store.image_url}
                  alt={store.store_name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 760px"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#f7f7f7] to-[#e9edf2] text-muted">
                  Sin imagen de tienda
                </div>
              )}
            </div>

            <div className="mt-6 border-b border-[#e5e7eb] pb-6">
              <h1 className="page-title text-3xl sm:text-4xl">
                {store.store_name}
              </h1>
              <p className="mt-3 max-w-3xl text-muted">
                {store.description || "Tienda disponible cerca de ti."}
              </p>
              <div className="mt-4 space-y-1 text-sm text-muted">
                <p>{store.address_text}</p>
                <p>
                  {[store.district, store.city, store.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p>Horario: {formatOpeningHours(store.opening_hours)}</p>
              </div>
            </div>

            <section className="mt-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Productos</h2>
                  <p className="mt-1 text-sm text-muted">
                    Agrega productos de esta tienda a tu reserva.
                  </p>
                </div>
              </div>

              {catalog.length > 0 && (
                <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
                  <button
                    type="button"
                    onClick={() => setActiveCategoryId("all")}
                    className={
                      activeCategoryId === "all"
                        ? "chip-selected shrink-0 px-4 py-2 text-sm"
                        : "shrink-0 rounded-full border border-[#d1d5db] px-4 py-2 text-sm font-semibold"
                    }
                  >
                    Todos ({catalog.length})
                  </button>

                  {catalogCategories.map((category) => {
                    const key = categoryKey(category.category_id);

                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setActiveCategoryId(key)}
                        className={
                          activeCategoryId === key
                            ? "chip-selected shrink-0 px-4 py-2 text-sm"
                            : "shrink-0 rounded-full border border-[#d1d5db] px-4 py-2 text-sm font-semibold"
                        }
                      >
                        {category.category_name} ({category.product_count})
                      </button>
                    );
                  })}
                </div>
              )}

              {catalog.length === 0 ? (
                <div className="info-box mt-5">
                  Esta tienda todavia no tiene productos disponibles.
                </div>
              ) : (
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {filteredCatalog.map((item) => {
                    const highlighted = item.id === highlightedProductId;

                    return (
                      <article
                        key={item.id}
                        ref={highlighted ? highlightedRef : null}
                        className={`rounded-xl border bg-white p-4 transition ${
                          highlighted
                            ? "border-[var(--primary)] shadow-[0_10px_30px_rgba(121,0,243,0.13)]"
                            : "border-[var(--border)] hover:shadow-md"
                        }`}
                      >
                        <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-[#eef1f4]">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.product?.product_name ?? "Producto"}
                              fill
                              sizes="(max-width: 768px) 100vw, 360px"
                              className="object-contain p-2"
                            />
                          ) : (
                            <span className="text-sm text-muted">
                              Sin imagen
                            </span>
                          )}
                        </div>

                        <h3 className="mt-4 text-lg font-semibold">
                          {item.product?.product_name ?? "Producto"}
                        </h3>
                        <p className="mt-1 text-xs font-semibold uppercase text-[var(--primary)]">
                          {item.product?.category_name ?? "Sin categoria"}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-muted">
                          {item.product?.description || "Sin descripcion"}
                        </p>
                        <div className="mt-3 text-sm text-muted">
                          <p>Precio: S/ {Number(item.price).toFixed(2)}</p>
                          <p>Stock: {item.stock}</p>
                        </div>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
                            className="app-input sm:w-24"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddCatalogItem(item)}
                            className="btn-primary flex-1"
                          >
                            <Plus size={18} />
                            Agregar
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-[0_14px_36px_rgba(44,47,48,0.10)]">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <ShoppingBasket size={21} className="text-[var(--primary)]" />
                Tu reserva
              </h2>
              <p className="mt-1 text-sm text-muted">{store.store_name}</p>

              {cartItems.length === 0 ? (
                <div className="info-box mt-4">
                  Todavia no agregaste productos.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={item.store_product_id}
                      className="rounded-2xl bg-[#f7f7f7] p-3"
                    >
                      <div className="flex gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#eef1f4]">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.product_name}
                              fill
                              sizes="56px"
                              className="object-contain p-1"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {item.product_name}
                          </p>
                          <p className="text-sm text-muted">
                            S/ {Number(item.price).toFixed(2)} c/u
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
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
                          className="app-input h-11 flex-1 py-2"
                        />
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.store_product_id)}
                          className="icon-button text-[var(--danger)] hover:bg-red-50 hover:text-[var(--danger)]"
                          aria-label={`Quitar ${item.product_name}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 grid gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Fecha de recojo
                  </label>
                  <input
                    type="date"
                    value={pickupDate}
                    min={getTodayDateInput()}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Hora disponible
                  </label>
                  <select
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    disabled={pickupSlots.length === 0}
                    className="app-input disabled:opacity-60"
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
                  <label className="mb-2 block text-sm font-semibold">
                    Nota opcional
                  </label>
                  <input
                    type="text"
                    value={reservationNotes}
                    onChange={(e) => setReservationNotes(e.target.value)}
                    placeholder="Ejemplo: pasare despues del trabajo"
                    className="app-input"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#e5e7eb] pt-4">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold">
                  S/ {cartTotal.toFixed(2)}
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={handleCreateReservation}
                  disabled={creatingReservation}
                  className="btn-primary disabled:opacity-60"
                >
                  {creatingReservation
                    ? "Confirmando..."
                    : !currentUserId
                    ? "Inicia sesion para confirmar"
                    : currentRole !== "customer"
                    ? "Solo cliente puede confirmar"
                    : "Confirmar reserva"}
                </button>

                {cartItems.length > 0 && (
                  <button type="button" onClick={clearCart} className="btn-soft">
                    Vaciar reserva
                  </button>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
