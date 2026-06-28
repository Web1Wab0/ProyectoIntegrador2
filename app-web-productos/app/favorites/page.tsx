"use client";

import Image from "next/image";
import Link from "next/link";
import { PackageSearch, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import FavoriteButton from "../../components/favorite-button";
import PageLoading from "../../components/page-loading";
import EmptyState from "../../components/empty-state";

type StoreFavorite = {
  store_id: string;
  stores: {
    id: string;
    store_name: string;
    description: string | null;
    image_url: string | null;
    address_text: string;
  } | null;
};

type ProductFavorite = {
  store_product_id: string;
  store_products: {
    id: string;
    store_id: string;
    price: number;
    stock: number;
    image_url: string | null;
    stores: { store_name: string } | null;
    products: { product_name: string; description: string | null } | null;
  } | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function FavoritesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreFavorite[]>([]);
  const [products, setProducts] = useState<ProductFavorite[]>([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth/sign-in?next=/favorites");
        return;
      }

      const [storeResponse, productResponse] = await Promise.all([
        supabase.from("favorite_stores").select(`
          store_id,
          stores:store_id (id, store_name, description, image_url, address_text)
        `).eq("user_id", auth.session.user.id),
        supabase.from("favorite_products").select(`
          store_product_id,
          store_products:store_product_id (
            id, store_id, price, stock, image_url,
            stores:store_id (store_name),
            products:product_id (product_name, description)
          )
        `).eq("user_id", auth.session.user.id),
      ]);

      if (!mounted) return;
      setStores(
        ((storeResponse.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
          store_id: String(row.store_id),
          stores: one(row.stores as StoreFavorite["stores"] | StoreFavorite["stores"][]),
        }))
      );
      setProducts(
        ((productResponse.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
          const storeProduct = one(
            row.store_products as ProductFavorite["store_products"] | ProductFavorite["store_products"][]
          );
          return {
            store_product_id: String(row.store_product_id),
            store_products: storeProduct
              ? {
                  ...storeProduct,
                  stores: one(storeProduct.stores as typeof storeProduct.stores | Array<NonNullable<typeof storeProduct.stores>>),
                  products: one(storeProduct.products as typeof storeProduct.products | Array<NonNullable<typeof storeProduct.products>>),
                }
              : null,
          };
        })
      );
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  if (loading) return <PageLoading label="Cargando favoritos" />;

  return (
    <main className="app-page">
      <div className="mx-auto max-w-6xl">
        <h1 className="page-title text-3xl">Favoritos</h1>
        <p className="mt-2 text-muted">
          Guarda tiendas y productos para volver a encontrarlos rápidamente.
        </p>

        <section className="mt-8">
          <h2 className="section-title flex items-center gap-2 text-xl">
            <Store size={20} className="text-[var(--primary)]" />
            Tiendas
          </h2>
          {stores.length === 0 ? (
            <EmptyState
              icon={Store}
              title="Sin tiendas favoritas"
              description="Guarda tus tiendas preferidas para volver a ellas sin buscarlas de nuevo."
              action={{ label: "Explorar tiendas", href: "/" }}
              className="mt-4"
            />
          ) : (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((favorite) => {
                const store = favorite.stores;
                if (!store) return null;
                return (
                  <Link key={store.id} href={`/stores/${store.id}`} className="listing-card app-card overflow-hidden">
                    <div className="listing-card-media listing-card-media-cover relative h-48 bg-[var(--surface-high)]">
                      {store.image_url ? (
                        <Image src={store.image_url} alt={store.store_name} fill className="object-cover" />
                      ) : null}
                      <FavoriteButton kind="store" id={store.id} storeId={store.id} className="absolute right-3 top-3" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold">{store.store_name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{store.description || store.address_text}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="section-title flex items-center gap-2 text-xl">
            <PackageSearch size={20} className="text-[var(--secondary)]" />
            Productos
          </h2>
          {products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Sin productos favoritos"
              description="Marca productos con el corazón para seguirlos y encontrarlos rápidamente."
              action={{ label: "Buscar productos", href: "/" }}
              className="mt-4"
            />
          ) : (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((favorite) => {
                const item = favorite.store_products;
                if (!item) return null;
                return (
                  <Link key={item.id} href={`/stores/${item.store_id}?product=${item.id}`} className="listing-card app-card p-4">
                    <div className="listing-card-media relative h-44 rounded-lg bg-[var(--surface-high)]">
                      {item.image_url ? (
                        <Image src={item.image_url} alt={item.products?.product_name || "Producto"} fill className="object-contain p-3" />
                      ) : null}
                      <FavoriteButton kind="product" id={item.id} storeId={item.store_id} className="absolute right-2 top-2" />
                    </div>
                    <h3 className="mt-4 font-semibold">{item.products?.product_name || "Producto"}</h3>
                    <p className="mt-1 text-sm text-muted">{item.stores?.store_name}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <strong>S/ {Number(item.price).toFixed(2)}</strong>
                      <span className="text-xs text-muted">Stock {item.stock}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
