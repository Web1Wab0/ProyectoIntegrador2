"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  PackageSearch,
  Plus,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import {
  getAvailablePickupSlots,
  getOpeningDayForDate,
  getTodayDateInput,
  normalizeOpeningHours,
  type StoreOpeningHours,
} from "../../../lib/store-hours";
import Notice from "../../../components/notice";
import PickupTimePicker from "../../../components/pickup-time-picker";
import StoreHoursDisplay from "../../../components/store-hours-display";
import FavoriteButton from "../../../components/favorite-button";
import RatingSummary from "../../../components/rating-summary";
import { recordStoreEvent } from "../../../lib/analytics";
import EmptyState from "../../../components/empty-state";
import { SkeletonGrid } from "../../../components/skeleton-card";

const UNCATEGORIZED_ID = "uncategorized";
const springTransition = {
  type: "spring",
  stiffness: 420,
  damping: 36,
  mass: 0.75,
} as const;
const softSpringTransition = {
  type: "spring",
  stiffness: 360,
  damping: 34,
  mass: 0.85,
} as const;
const catalogContainerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.05,
    },
  },
};
const catalogItemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springTransition,
  },
};

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
    is_age_restricted: boolean;
  } | null;
};

type CartItem = {
  store_product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  stock: number;
  is_age_restricted: boolean;
};

type MaybeArray<T> = T | T[] | null;

type RawStoreRow = Omit<StoreDetails, "opening_hours" | "image_url"> & {
  image_url?: string | null;
  opening_hours?: unknown;
};

type StoreCatalogCategory = {
  id: string;
  name: string;
  is_age_restricted?: boolean;
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
          is_age_restricted: category?.is_age_restricted === true,
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

type ProductDetailModalProps = {
  item: StoreCatalogItem;
  storeId: string;
  quantity: number;
  rating: { average: number; count: number };
  shouldReduceMotion: boolean;
  onClose: () => void;
  onQuantityChange: (quantity: number) => void;
  onAdd: () => void;
};

function ProductDetailModal({
  item,
  storeId,
  quantity,
  rating,
  shouldReduceMotion,
  onClose,
  onQuantityChange,
  onAdd,
}: ProductDetailModalProps) {
  const productName = item.product?.product_name ?? "Producto";
  const categoryName = item.product?.category_name ?? "Sin categoria";

  return (
    <motion.div
      className="fixed inset-0 z-[10050] flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="presentation"
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0 }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-xl"
        onClick={onClose}
        aria-label="Cerrar detalle de producto"
      />

      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`product-detail-${item.id}`}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-lowest)] shadow-[var(--shadow-popover)] sm:grid sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
        initial={
          shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={
          shouldReduceMotion ? undefined : { opacity: 0, y: 18, scale: 0.98 }
        }
        transition={softSpringTransition}
      >
        <motion.div
          layoutId={`product-image-${item.id}`}
          className="relative flex min-h-48 max-h-[32dvh] items-center justify-center bg-[#eef1f4] sm:max-h-none sm:min-h-full"
        >
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={productName}
              fill
              sizes="(max-width: 640px) 100vw, 380px"
              className="object-contain p-5"
              priority
            />
          ) : (
            <span className="text-sm text-muted">Sin imagen</span>
          )}
        </motion.div>

        <div className="scrollbar-none min-h-0 min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-[var(--primary)]">
                {categoryName}
                {item.product?.is_age_restricted ? " · 18+" : ""}
              </p>
              <h2
                id={`product-detail-${item.id}`}
                className="mt-2 break-words text-2xl font-bold leading-tight"
              >
                {productName}
              </h2>
              <div className="mt-2">
                <RatingSummary
                  average={rating.average}
                  count={rating.count}
                  compact
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="icon-button shrink-0"
              aria-label="Cerrar"
            >
              <X size={19} />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <FavoriteButton kind="product" id={item.id} storeId={storeId} />
            {item.product?.brand && (
              <span className="rounded-full bg-[var(--surface-high)] px-3 py-1 text-xs font-semibold text-muted">
                {item.product.brand}
              </span>
            )}
            <span className="rounded-full bg-[var(--surface-high)] px-3 py-1 text-xs font-semibold text-muted">
              Stock {item.stock}
            </span>
          </div>

          <p className="scrollbar-none mt-5 max-h-32 overflow-y-auto break-words text-sm leading-6 text-muted sm:max-h-none">
            {item.product?.description || "Sin descripcion disponible."}
          </p>

          <div className="sticky bottom-0 -mx-5 mt-6 rounded-t-2xl border border-[var(--border)] bg-[var(--surface-lowest)] p-4 shadow-[0_-12px_30px_rgba(44,47,48,0.10)] sm:static sm:mx-0 sm:rounded-2xl sm:bg-[var(--surface-high)] sm:shadow-none">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-muted">
                  Precio
                </p>
                <p className="mt-1 text-2xl font-bold">
                  S/ {Number(item.price).toFixed(2)}
                </p>
              </div>
              <div className="w-28">
                <label className="mb-2 block text-xs font-semibold text-muted">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  max={item.stock}
                  value={quantity}
                  onChange={(event) =>
                    onQuantityChange(Number(event.target.value))
                  }
                  className="app-input h-11"
                />
              </div>
            </div>

            <motion.button
              type="button"
              onClick={onAdd}
              className="btn-primary mt-4 w-full"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
              transition={softSpringTransition}
            >
              <Plus size={18} />
              Agregar a reserva
            </motion.button>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function categoryKey(categoryId: string | null) {
  return categoryId ?? UNCATEGORIZED_ID;
}

export default function StorePage() {
  const supabase = useMemo(() => createClient(), []);
  const shouldReduceMotion = useReducedMotion() === true;
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
  const [reservationSheetOpen, setReservationSheetOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreCatalogItem | null>(
    null
  );
  const [pickupDate, setPickupDate] = useState(() => getTodayDateInput());
  const [pickupTime, setPickupTime] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");
  const [creatingReservation, setCreatingReservation] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [storeRating, setStoreRating] = useState({ average: 0, count: 0 });
  const [productRatings, setProductRatings] = useState<
    Record<string, { average: number; count: number }>
  >({});
  const trackedStoreRef = useRef(false);
  const appliedReorderRef = useRef(false);
  const reorderReservationId = searchParams.get("reorder");

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

    async function queryProducts(includeRestricted: boolean) {
      return supabase
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
              ${includeRestricted ? ", is_age_restricted" : ""}
            )
          )
        `
      )
      .eq("store_id", storeId)
      .eq("is_available", true)
      .gt("stock", 0)
      .order("created_at", { ascending: false });
    }

    let { data: productsData, error: productsError } = await queryProducts(true);
    if (productsError && isMissingColumnError(productsError)) {
      const fallback = await queryProducts(false);
      productsData = fallback.data;
      productsError = fallback.error;
    }

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
    const [storeReviewResponse, productReviewResponse] = await Promise.all([
      supabase
        .from("store_review_summaries")
        .select("rating_average, review_count")
        .eq("store_id", storeId)
        .maybeSingle(),
      supabase
        .from("product_review_summaries")
        .select("store_product_id, rating_average, review_count")
        .in(
          "store_product_id",
          ((productsData as RawStoreCatalogItem[]) ?? []).map((item) => item.id)
        ),
    ]);
    if (storeReviewResponse.data) {
      setStoreRating({
        average: Number(storeReviewResponse.data.rating_average ?? 0),
        count: Number(storeReviewResponse.data.review_count ?? 0),
      });
    }
    const ratings: Record<string, { average: number; count: number }> = {};
    (productReviewResponse.data ?? []).forEach((row) => {
      ratings[row.store_product_id] = {
        average: Number(row.rating_average ?? 0),
        count: Number(row.review_count ?? 0),
      };
    });
    setProductRatings(ratings);
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
        .select("role, adult_content_confirmed")
        .eq("id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (typeof data?.role === "string") {
        setCurrentRole(data.role);
      }
      setAdultConfirmed(data?.adult_content_confirmed === true);
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

  useEffect(() => {
    if (!store || trackedStoreRef.current) return;
    trackedStoreRef.current = true;
    void recordStoreEvent(supabase, { eventType: "store_view", storeId: store.id });
  }, [store, supabase]);

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
  const cartQuantity = cartItems.reduce((acc, item) => acc + item.quantity, 0);

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
    if (!selectedProduct) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedProduct(null);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedProduct]);

  useEffect(() => {
    if (!reservationSheetOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setReservationSheetOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [reservationSheetOpen]);

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

  useEffect(() => {
    if (!highlightedProductId || !store) return;
    void recordStoreEvent(supabase, {
      eventType: "product_view",
      storeId: store.id,
      storeProductId: highlightedProductId,
    });
  }, [highlightedProductId, store, supabase]);

  useEffect(() => {
    if (
      !reorderReservationId ||
      !currentUserId ||
      !catalog.length ||
      appliedReorderRef.current
    ) return;
    appliedReorderRef.current = true;

    void (async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, customer_user_id, reservation_items(store_product_id, quantity)")
        .eq("id", reorderReservationId)
        .eq("customer_user_id", currentUserId)
        .maybeSingle();
      if (error || !data) return;

      const available: CartItem[] = [];
      const unavailable: string[] = [];
      const rawItems = (data.reservation_items ?? []) as Array<{
        store_product_id: string;
        quantity: number;
      }>;
      rawItems.forEach((oldItem) => {
        const current = catalog.find((item) => item.id === oldItem.store_product_id);
        if (!current?.product || current.stock <= 0) {
          unavailable.push(current?.product?.product_name ?? "Un producto");
          return;
        }
        available.push({
          store_product_id: current.id,
          product_name: current.product.product_name,
          price: Number(current.price),
          quantity: Math.min(oldItem.quantity, current.stock),
          image_url: current.image_url,
          stock: current.stock,
          is_age_restricted: current.product.is_age_restricted,
        });
      });
      setCartItems(available);
      setNotice({
        type: unavailable.length ? "warning" : "success",
        message: unavailable.length
          ? `Reconstruimos tu pedido con precios actuales. No disponibles: ${unavailable.join(", ")}.`
          : "Pedido reconstruido con precios y stock actuales.",
      });
    })();
  }, [catalog, currentUserId, reorderReservationId, supabase]);

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
      is_age_restricted: item.product.is_age_restricted,
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

    if (cartItems.some((item) => item.is_age_restricted) && !adultConfirmed) {
      setNotice({
        type: "warning",
        message: "Debes declarar que eres mayor de edad para reservar artículos 18+.",
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
    setReservationSheetOpen(false);
    setCreatingReservation(false);
    setNotice({
      type: "success",
      message: "Reserva creada correctamente. Te llevaremos a Mis reservas...",
    });

    window.setTimeout(() => {
      window.location.replace("/customer/reservations");
    }, 1200);
  }

  function renderReservationPanel({ mobile = false }: { mobile?: boolean } = {}) {
    if (!store) return null;

    return (
      <div
        className={`flex min-h-0 w-full max-w-full flex-col overflow-hidden border border-[var(--border)] bg-white shadow-[0_14px_36px_rgba(44,47,48,0.10)] ${
          mobile
            ? "h-full rounded-t-[22px]"
            : "max-h-[calc(100vh-7rem)] rounded-xl"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <ShoppingBasket size={21} className="text-[var(--primary)]" />
              Tu reserva
            </h2>
            <p className="mt-1 break-words text-sm text-muted">
              {store.store_name}
            </p>
          </div>
          {mobile ? (
            <button
              type="button"
              onClick={() => setReservationSheetOpen(false)}
              className="icon-button"
              aria-label="Cerrar reserva"
            >
              <X size={19} />
            </button>
          ) : null}
        </div>

        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto p-5">
          {cartItems.length === 0 ? (
            <div className="info-box">
              Todavia no agregaste productos.
            </div>
          ) : (
            <motion.div layout className="min-w-0 space-y-3">
              <AnimatePresence initial={false}>
                {cartItems.map((item) => (
                  <motion.div
                    key={item.store_product_id}
                    layout
                    initial={
                      shouldReduceMotion
                        ? false
                        : { opacity: 0, y: 8, scale: 0.98 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      shouldReduceMotion
                        ? undefined
                        : { opacity: 0, y: -8, scale: 0.98 }
                    }
                    transition={softSpringTransition}
                    className="min-w-0 w-full max-w-full rounded-2xl bg-[#f7f7f7] p-3"
                  >
                    <div className="flex min-w-0 gap-3">
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
                        <p className="break-words text-sm font-semibold">
                          {item.product_name}
                        </p>
                        <p className="text-sm text-muted">
                          S/ {Number(item.price).toFixed(2)} c/u
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_40px] gap-2">
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
                        className="app-input h-11 min-w-0 max-w-full py-2"
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
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          <div className="mt-5 grid min-w-0 gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays size={17} className="text-[var(--primary)]" />
                <label className="text-sm font-semibold">Fecha de recojo</label>
              </div>
              <div className="min-w-0 max-w-full rounded-lg border border-[var(--border)] bg-[var(--surface-high)] p-1">
                <input
                  type="date"
                  value={pickupDate}
                  min={getTodayDateInput()}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="app-input min-w-0 max-w-full border-0 bg-white"
                />
              </div>
            </div>

            {cartItems.some((item) => item.is_age_restricted) && (
              <label className="flex min-w-0 max-w-full items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <input
                  type="checkbox"
                  checked={adultConfirmed}
                  onChange={async (event) => {
                    const checked = event.target.checked;
                    setAdultConfirmed(checked);
                    if (currentUserId) {
                      await supabase
                        .from("profiles")
                        .update({ adult_content_confirmed: checked })
                        .eq("id", currentUserId);
                    }
                  }}
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                />
                <span className="min-w-0 break-words">
                  Declaro que soy mayor de 18 años y presentaré identificación si la tienda la solicita.
                </span>
              </label>
            )}

            <PickupTimePicker
              slots={pickupSlots}
              value={pickupTime}
              onChange={setPickupTime}
              isClosed={selectedPickupDay?.closed === true}
            />

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Nota opcional
              </label>
              <input
                type="text"
                value={reservationNotes}
                onChange={(e) => setReservationNotes(e.target.value)}
                placeholder="Ejemplo: pasare despues del trabajo"
                className="app-input min-w-0 max-w-full"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold">S/ {cartTotal.toFixed(2)}</span>
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
            <Link
              href="/complaints"
              className="break-words text-center text-xs text-muted underline"
            >
              Libro de Reclamaciones demostrativo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="app-page">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="skeleton h-8 w-40 rounded-lg" />
          <div className="skeleton h-[360px] rounded-xl" />
          <SkeletonGrid count={2} imageHeightClass="h-44" />
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
    <main
      className={`min-h-screen bg-white text-[var(--on-surface)] ${
        cartItems.length > 0 ? "pb-28 lg:pb-0" : ""
      }`}
    >
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

        <section className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start">
          <div className="min-w-0">
            <div className="relative h-[260px] w-full max-w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[#eef1f4] sm:h-[380px]">
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

            <div className="mt-6 min-w-0 border-b border-[#e5e7eb] pb-6">
              <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="page-title text-3xl sm:text-4xl">{store.store_name}</h1>
                  <div className="mt-2">
                    <RatingSummary average={storeRating.average} count={storeRating.count} />
                  </div>
                </div>
                <FavoriteButton kind="store" id={store.id} storeId={store.id} />
              </div>
              <p className="mt-3 max-w-3xl break-words text-muted">
                {store.description || "Tienda disponible cerca de ti."}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-high)] p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--primary)]">
                    <MapPin size={18} />
                  </div>
                  <div className="min-w-0 break-words text-sm">
                    <p className="font-semibold text-[var(--on-surface)]">
                      Ubicación
                    </p>
                    <p className="mt-1 text-muted">{store.address_text}</p>
                    <p className="text-muted">
                      {[store.district, store.city, store.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>

                <StoreHoursDisplay hours={store.opening_hours} />
              </div>
            </div>

            <section className="mt-8 min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Productos</h2>
                  <p className="mt-1 text-sm text-muted">
                    Agrega productos de esta tienda a tu reserva.
                  </p>
                </div>
              </div>

              {catalog.length > 0 && (
                <div className="scrollbar-none mt-5 flex max-w-full gap-2 overflow-x-auto pb-2">
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

              <LayoutGroup id={`store-${store.id}-catalog`}>
                {catalog.length === 0 ? (
                  <EmptyState
                    icon={PackageSearch}
                    title="Catálogo en preparación"
                    description="Esta tienda todavía no tiene productos disponibles para reservar."
                    className="mt-5 shadow-none"
                  />
                ) : (
                  <motion.div
                    className="mt-6 grid min-w-0 gap-5 md:grid-cols-2"
                    variants={
                      shouldReduceMotion ? undefined : catalogContainerVariants
                    }
                    initial={shouldReduceMotion ? false : "hidden"}
                    animate="show"
                  >
                    {filteredCatalog.map((item) => {
                      const highlighted = item.id === highlightedProductId;

                      return (
                        <motion.article
                          key={item.id}
                          ref={highlighted ? highlightedRef : null}
                          layout
                          variants={
                            shouldReduceMotion
                              ? undefined
                              : catalogItemVariants
                          }
                          whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                          whileTap={
                            shouldReduceMotion ? undefined : { scale: 0.99 }
                          }
                          transition={softSpringTransition}
                          className={`min-w-0 max-w-full rounded-xl border bg-white p-4 transition ${
                            highlighted
                              ? "border-[var(--primary)] shadow-[0_10px_30px_rgba(121,0,243,0.13)]"
                              : "border-[var(--border)] hover:shadow-md"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedProduct(item)}
                            className="block w-full rounded-2xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
                            aria-label={`Ver detalle de ${
                              item.product?.product_name ?? "producto"
                            }`}
                          >
                            <motion.div
                              layoutId={`product-image-${item.id}`}
                              className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-[#eef1f4]"
                            >
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
                            </motion.div>
                          </button>

                          <div className="mt-4 flex min-w-0 items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedProduct(item)}
                              className="min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--primary)]"
                            >
                              <h3 className="break-words text-lg font-semibold">
                                {item.product?.product_name ?? "Producto"}
                              </h3>
                              <RatingSummary
                                average={productRatings[item.id]?.average ?? 0}
                                count={productRatings[item.id]?.count ?? 0}
                                compact
                              />
                            </button>
                            <FavoriteButton
                              kind="product"
                              id={item.id}
                              storeId={store.id}
                            />
                          </div>
                          <p className="mt-1 text-xs font-semibold uppercase text-[var(--primary)]">
                            {item.product?.category_name ?? "Sin categoria"}
                            {item.product?.is_age_restricted ? " · 18+" : ""}
                          </p>
                          <p className="mt-2 line-clamp-2 break-words text-sm text-muted">
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
                        </motion.article>
                      );
                    })}
                  </motion.div>
                )}

                <AnimatePresence>
                  {selectedProduct && (
                    <ProductDetailModal
                      item={selectedProduct}
                      storeId={store.id}
                      quantity={quantityById[selectedProduct.id] ?? 1}
                      rating={
                        productRatings[selectedProduct.id] ?? {
                          average: 0,
                          count: 0,
                        }
                      }
                      shouldReduceMotion={shouldReduceMotion}
                      onClose={() => setSelectedProduct(null)}
                      onQuantityChange={(quantity) =>
                        setQuantityById((prev) => ({
                          ...prev,
                          [selectedProduct.id]: quantity,
                        }))
                      }
                      onAdd={() => handleAddCatalogItem(selectedProduct)}
                    />
                  )}
                </AnimatePresence>
              </LayoutGroup>
            </section>
          </div>

          <motion.aside
            className="hidden min-w-0 w-full max-w-full lg:sticky lg:top-24 lg:block"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={softSpringTransition}
          >
            {renderReservationPanel()}
          </motion.aside>
        </section>
      </div>

      <AnimatePresence>
        {cartItems.length > 0 ? (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[10030] border-t border-[var(--border)] bg-white/95 px-4 py-3 shadow-[0_-16px_40px_rgba(44,47,48,0.16)] backdrop-blur-xl lg:hidden"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: 24 }}
            transition={softSpringTransition}
          >
            <div className="mx-auto flex max-w-xl items-center gap-3 pb-[env(safe-area-inset-bottom)]">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {cartQuantity} {cartQuantity === 1 ? "producto" : "productos"}
                </p>
                <p className="text-sm text-muted">
                  Total: S/ {cartTotal.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReservationSheetOpen(true)}
                className="btn-primary shrink-0 px-5"
              >
                Ver reserva
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {reservationSheetOpen ? (
          <motion.div
            className="fixed inset-0 z-[10040] flex items-end lg:hidden"
            role="presentation"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-xl"
              onClick={() => setReservationSheetOpen(false)}
              aria-label="Cerrar reserva"
            />
            <motion.section
              className="relative z-10 h-[88dvh] w-full"
              role="dialog"
              aria-modal="true"
              aria-label="Detalle de reserva"
              initial={shouldReduceMotion ? false : { y: "100%" }}
              animate={{ y: 0 }}
              exit={shouldReduceMotion ? undefined : { y: "100%" }}
              transition={softSpringTransition}
            >
              {renderReservationPanel({ mobile: true })}
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
