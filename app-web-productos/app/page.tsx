"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import AuthAccessMenu from "../components/auth-access-menu";
import Notice from "../components/notice";

const SearchMap = dynamic(() => import("../components/search-map"), {
  ssr: false,
});

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

export default function SearchPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [radius, setRadius] = useState("5000");
  const [quantityById, setQuantityById] = useState<Record<string, number>>({});
  const [results, setResults] = useState<SearchResult[]>([]);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [searching, setSearching] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [cartStoreId, setCartStoreId] = useState<string | null>(null);
  const [cartStoreName, setCartStoreName] = useState("");
  const [cartStoreAddress, setCartStoreAddress] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [pickupAt, setPickupAt] = useState("");
  const [reservationNotes, setReservationNotes] = useState("");
  const [storeCatalog, setStoreCatalog] = useState<StoreCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [creatingReservation, setCreatingReservation] = useState(false);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentUserId(null);
        setCurrentRole(null);
        setAuthLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setCurrentUserId(user.id);
      setCurrentRole(profile?.role ?? null);
      setAuthLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setCurrentUserId(null);
        setCurrentRole(null);
        setAuthLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      setCurrentUserId(session.user.id);
      setCurrentRole(profile?.role ?? null);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  function getMinPickupDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  function clearCart() {
    setCartStoreId(null);
    setCartStoreName("");
    setCartStoreAddress("");
    setCartItems([]);
    setPickupAt("");
    setReservationNotes("");
    setStoreCatalog([]);
  }

  async function loadStoreCatalog(storeId: string) {
    setLoadingCatalog(true);

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
          brand
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

    setStoreCatalog((data as StoreCatalogItem[]) ?? []);
    setLoadingCatalog(false);
  }

  async function prepareCartStore(
    storeId: string,
    storeName: string,
    storeAddress: string
  ) {
    if (cartStoreId && cartStoreId !== storeId) {
      const confirmed = window.confirm(
        "Tu reserva actual pertenece a otro local. ¿Deseas vaciarla y cambiar de tienda?"
      );

      if (!confirmed) return false;

      clearCart();
    }

    if (cartStoreId !== storeId) {
      setCartStoreId(storeId);
      setCartStoreName(storeName);
      setCartStoreAddress(storeAddress);
      await loadStoreCatalog(storeId);
    }

    return true;
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
          message: `No puedes agregar más de ${item.stock} unidades de ${item.product_name}.`,
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
      item.address_text
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

  function handleGetLocation() {
    if (!navigator.geolocation) {
      setNotice({
        type: "error",
        message: "Tu navegador no soporta geolocalización.",
      });
      return;
    }

    setLoadingLocation(true);
    setNotice(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLat(position.coords.latitude);
        setUserLng(position.coords.longitude);
        setLoadingLocation(false);
        setNotice({
          type: "success",
          message: "Ubicación obtenida correctamente.",
        });
      },
      (error) => {
        setLoadingLocation(false);
        setNotice({
          type: "error",
          message: `No se pudo obtener la ubicación: ${error.message}`,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
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
        message: "Primero debes obtener tu ubicación.",
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

    const rows = (data as SearchResult[]) ?? [];
    setResults(rows);
    setSearching(false);

    if (rows.length === 0) {
      setNotice({
        type: "warning",
        message: "No se encontraron productos cercanos para esa búsqueda.",
      });
    } else {
      setNotice(null);
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

    if (!pickupAt) {
      setNotice({
        type: "warning",
        message: "Debes indicar la fecha y hora de recojo.",
      });
      return;
    }

    if (!currentUserId) {
      setNotice({
        type: "warning",
        message: "Debes iniciar sesión como cliente para reservar.",
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
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="mb-4 flex justify-end">
          <AuthAccessMenu />
        </div>

        <div className="rounded-2xl bg-gray-900 p-6 shadow-lg">
          <h1 className="text-3xl font-bold">Buscar productos cercanos</h1>
          <p className="mt-2 text-gray-400">
            Usa tu ubicación para encontrar productos disponibles cerca de ti.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={handleGetLocation}
              disabled={loadingLocation}
              className="rounded-lg bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {loadingLocation ? "Obteniendo ubicación..." : "Usar mi ubicación"}
            </button>

            {userLat !== null && userLng !== null && (
              <div className="rounded-lg bg-gray-800 px-4 py-3 text-sm text-gray-300">
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
              className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
            />

            <select
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
            >
              <option value="1000">1 km</option>
              <option value="3000">3 km</option>
              <option value="5000">5 km</option>
              <option value="10000">10 km</option>
            </select>

            <button
              type="submit"
              disabled={searching}
              className="rounded-lg bg-green-600 px-4 py-3 font-semibold hover:bg-green-700 disabled:opacity-60"
            >
              {searching ? "Buscando..." : "Buscar"}
            </button>
          </form>

          <div className="mt-4 rounded-xl bg-gray-800 p-4 text-sm text-gray-300">
            Puedes buscar productos libremente. Para confirmar una reserva, debes
            iniciar sesión con una cuenta de cliente.
          </div>

          {notice && (
            <div className="mt-4">
              <Notice type={notice.type} message={notice.message} />
            </div>
          )}
        </div>

        {userLat !== null && userLng !== null && (
          <div className="rounded-2xl bg-gray-900 p-4 shadow-lg">
            <SearchMap userLat={userLat} userLng={userLng} results={results} />
          </div>
        )}

        {cartStoreId && (
          <div className="rounded-2xl bg-gray-900 p-6 shadow-lg">
            <h2 className="text-2xl font-bold">Mi reserva</h2>
            <p className="mt-2 text-gray-400">
              Local seleccionado:{" "}
              <span className="font-semibold text-white">{cartStoreName}</span>
            </p>
            <p className="text-sm text-gray-400">{cartStoreAddress}</p>

            {cartItems.length === 0 ? (
              <div className="mt-4 rounded-xl bg-gray-800 p-4 text-gray-300">
                Todavía no agregaste productos.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={item.store_product_id}
                    className="rounded-xl bg-gray-800 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">{item.product_name}</p>
                        <p className="text-sm text-gray-400">
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
                          className="w-24 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 outline-none"
                        />

                        <button
                          onClick={() => removeCartItem(item.store_product_id)}
                          className="rounded-lg bg-red-600 px-4 py-2 font-semibold hover:bg-red-700"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Fecha y hora de recojo
                </label>
                <input
                  type="datetime-local"
                  value={pickupAt}
                  min={getMinPickupDateTime()}
                  onChange={(e) => setPickupAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Nota opcional
                </label>
                <input
                  type="text"
                  value={reservationNotes}
                  onChange={(e) => setReservationNotes(e.target.value)}
                  placeholder="Ejemplo: pasaré después del trabajo"
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 outline-none"
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
                    ? "Inicia sesión para confirmar"
                    : currentRole !== "customer"
                    ? "Solo cliente puede confirmar"
                    : "Confirmar reserva"}
                </button>
              </div>
            </div>
          </div>
        )}

        {cartStoreId && (
          <div className="rounded-2xl bg-gray-900 p-6 shadow-lg">
            <h2 className="text-2xl font-bold">Más productos de esta tienda</h2>
            <p className="mt-2 text-gray-400">
              Puedes agregar otros productos del mismo local a la misma reserva.
            </p>

            {loadingCatalog ? (
              <div className="mt-4 rounded-xl bg-gray-800 p-4 text-gray-300">
                Cargando productos del local...
              </div>
            ) : storeCatalog.length === 0 ? (
              <div className="mt-4 rounded-xl bg-gray-800 p-4 text-gray-300">
                No hay más productos disponibles en esta tienda.
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {storeCatalog.map((item) => (
                  <article key={item.id} className="rounded-xl bg-gray-800 p-4">
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

                    <p className="mt-2 text-sm text-gray-300">
                      {item.product?.description || "Sin descripción"}
                    </p>

                    <div className="mt-3 space-y-1 text-sm text-gray-300">
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
                        className="w-24 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 outline-none"
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
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="rounded-xl bg-gray-900 p-4 text-sm text-gray-300 shadow-lg">
            Se encontraron{" "}
            <span className="font-semibold text-white">{results.length}</span>{" "}
            productos cerca de tu ubicación.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((item) => (
            <article
              key={item.store_product_id}
              className="rounded-2xl bg-gray-900 p-5 shadow-lg"
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
                <div className="mb-4 flex h-48 items-center justify-center rounded-lg bg-gray-800 text-gray-300">
                  Sin imagen
                </div>
              )}

              <h2 className="text-xl font-semibold">{item.product_name}</h2>
              <p className="mt-2 text-sm text-gray-300">
                {item.product_description || "Sin descripción"}
              </p>

              <div className="mt-3 space-y-1 text-sm text-gray-300">
                <p>Tienda: {item.store_name}</p>
                <p>Dirección: {item.address_text}</p>
                <p>Precio: S/ {Number(item.price).toFixed(2)}</p>
                <p>Stock: {item.stock}</p>
                <p>Distancia: {Math.round(item.distance_meters)} m</p>
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
                  className="w-24 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 outline-none"
                />

                <button
                  onClick={() => handleAddSearchResult(item)}
                  className="flex-1 rounded-lg bg-amber-600 px-4 py-2 font-semibold hover:bg-amber-700"
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