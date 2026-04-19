"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Category = {
  id: string;
  name: string;
};

type ProductInfo = {
  id: string;
  product_name: string;
  description: string | null;
  brand: string | null;
  category_id: string | null;
};

type StoreProductRow = {
  id: string;
  price: number;
  stock: number;
  image_url: string | null;
  is_available: boolean;
  product: ProductInfo | null;
};

export default function MerchantProductsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [userId, setUserId] = useState("");
  const [storeId, setStoreId] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<StoreProductRow[]>([]);

  const [editingStoreProductId, setEditingStoreProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/sign-in");
      return;
    }

    setUserId(user.id);

    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (businessError) {
      setMessage(businessError.message);
      setLoading(false);
      return;
    }

    if (!businessData) {
      setMessage("Primero debes registrar tu negocio y tu tienda.");
      setLoading(false);
      return;
    }

    const { data: storeData, error: storeError } = await supabase
      .from("stores")
      .select("id, store_name")
      .eq("business_id", businessData.id)
      .limit(1)
      .maybeSingle();

    if (storeError) {
      setMessage(storeError.message);
      setLoading(false);
      return;
    }

    if (!storeData) {
      setMessage("Primero debes registrar tu tienda.");
      setLoading(false);
      return;
    }

    setStoreId(storeData.id);

    const { data: categoriesData, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name")
      .order("name", { ascending: true });

    if (categoriesError) {
      setMessage(categoriesError.message);
      setLoading(false);
      return;
    }

    setCategories(categoriesData ?? []);

    await loadStoreProducts(storeData.id);

    setLoading(false);
  }

  async function loadStoreProducts(currentStoreId: string) {
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
      category_id
    )
  `)
  .eq("store_id", currentStoreId)
  .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setProducts((data as StoreProductRow[]) ?? []);
  }

  function resetForm() {
    setEditingStoreProductId(null);
    setEditingProductId(null);
    setProductName("");
    setDescription("");
    setBrand("");
    setCategoryId("");
    setPrice("");
    setStock("");
    setImageFile(null);
    setCurrentImageUrl("");
  }

  async function uploadImageIfNeeded() {
    if (!imageFile) return currentImageUrl || null;

    const fileExt = imageFile.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, imageFile, { upsert: false });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    if (!storeId) {
      setMessage("No se encontró la tienda del local.");
      setSaving(false);
      return;
    }

    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      setMessage("El precio no es válido.");
      setSaving(false);
      return;
    }

    if (Number.isNaN(numericStock) || numericStock < 0) {
      setMessage("El stock no es válido.");
      setSaving(false);
      return;
    }

    try {
      const uploadedImageUrl = await uploadImageIfNeeded();

      if (editingStoreProductId && editingProductId) {
        const { error: productUpdateError } = await supabase
          .from("products")
          .update({
            product_name: productName,
            description: description || null,
            brand: brand || null,
            category_id: categoryId || null,
          })
          .eq("id", editingProductId);

        if (productUpdateError) {
          setMessage(productUpdateError.message);
          setSaving(false);
          return;
        }

        const { error: storeProductUpdateError } = await supabase
          .from("store_products")
          .update({
            price: numericPrice,
            stock: numericStock,
            image_url: uploadedImageUrl,
            is_available: numericStock > 0,
          })
          .eq("id", editingStoreProductId);

        if (storeProductUpdateError) {
          setMessage(storeProductUpdateError.message);
          setSaving(false);
          return;
        }

        setMessage("Producto actualizado correctamente.");
      } else {
        const { data: createdProduct, error: productInsertError } = await supabase
          .from("products")
          .insert({
            product_name: productName,
            description: description || null,
            brand: brand || null,
            category_id: categoryId || null,
          })
          .select("id")
          .single();

        if (productInsertError) {
          setMessage(productInsertError.message);
          setSaving(false);
          return;
        }

        const { error: storeProductInsertError } = await supabase
          .from("store_products")
          .insert({
            store_id: storeId,
            product_id: createdProduct.id,
            price: numericPrice,
            stock: numericStock,
            image_url: uploadedImageUrl,
            is_available: numericStock > 0,
          });

        if (storeProductInsertError) {
          setMessage(storeProductInsertError.message);
          setSaving(false);
          return;
        }

        setMessage("Producto creado correctamente.");
      }

      resetForm();
      await loadStoreProducts(storeId);
    } catch (error) {
      const err = error as Error;
      setMessage(err.message || "Ocurrió un error al subir la imagen.");
    }

    setSaving(false);
  }

  function handleEdit(item: StoreProductRow) {
    setEditingStoreProductId(item.id);
    setEditingProductId(item.product?.id ?? null);
    setProductName(item.product?.product_name ?? "");
    setDescription(item.product?.description ?? "");
    setBrand(item.product?.brand ?? "");
    setCategoryId(item.product?.category_id ?? "");
    setPrice(String(item.price ?? ""));
    setStock(String(item.stock ?? ""));
    setCurrentImageUrl(item.image_url ?? "");
    setImageFile(null);
    setMessage("");
  }

  async function handleDelete(storeProductId: string) {
    const confirmed = window.confirm("¿Seguro que deseas eliminar este producto de tu tienda?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("store_products")
      .delete()
      .eq("id", storeProductId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Producto eliminado de la tienda.");
    await loadStoreProducts(storeId);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Cargando productos...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-2xl bg-gray-900 p-6 shadow-lg h-fit">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">
                {editingStoreProductId ? "Editar producto" : "Nuevo producto"}
              </h1>
              <p className="mt-1 text-sm text-gray-400">
                Agrega productos, precios, stock e imagen.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="rounded-lg bg-gray-800 px-3 py-2 text-sm hover:bg-gray-700"
            >
              Volver
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm">Nombre del producto</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm">Marca</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm">Categoría</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
              >
                <option value="">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm">Precio</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">Stock</label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm">Imagen del producto</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none"
              />
            </div>

            {currentImageUrl && (
              <div className="rounded-xl bg-gray-800 p-3">
                <p className="mb-2 text-sm text-gray-300">Imagen actual</p>
                <Image
                  src={currentImageUrl}
                  alt="Producto"
                  width={160}
                  height={160}
                  className="rounded-lg object-cover"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                {saving
                  ? "Guardando..."
                  : editingStoreProductId
                  ? "Actualizar producto"
                  : "Crear producto"}
              </button>

              {editingStoreProductId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg bg-gray-700 px-4 py-3 font-semibold hover:bg-gray-600"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {message && (
            <p className="mt-4 rounded-lg bg-gray-800 p-4 text-sm text-gray-200">
              {message}
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-gray-900 p-6 shadow-lg">
          <h2 className="mb-6 text-2xl font-bold">Productos de la tienda</h2>

          {products.length === 0 ? (
            <div className="rounded-xl bg-gray-800 p-5 text-gray-300">
              Todavía no has agregado productos.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl bg-gray-800 p-4"
                >
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.product?.product_name ?? "Producto"}
                      width={400}
                      height={220}
                      className="mb-4 h-48 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mb-4 flex h-48 w-full items-center justify-center rounded-lg bg-gray-700 text-gray-300">
                      Sin imagen
                    </div>
                  )}

                  <h3 className="text-xl font-semibold">
                    {item.product?.product_name}
                  </h3>

                  <p className="mt-2 text-sm text-gray-300">
                    {item.product?.description || "Sin descripción"}
                  </p>

                  <div className="mt-3 space-y-1 text-sm text-gray-300">
                    <p>Marca: {item.product?.brand || "Sin marca"}</p>
                    <p>Precio: S/ {Number(item.price).toFixed(2)}</p>
                    <p>Stock: {item.stock}</p>
                    <p>
                      Estado: {item.is_available ? "Disponible" : "No disponible"}
                    </p>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-700"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="flex-1 rounded-lg bg-red-600 px-4 py-2 font-semibold hover:bg-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}