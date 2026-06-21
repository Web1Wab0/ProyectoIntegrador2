"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import Notice from "../../../components/notice";
import PageLoading from "../../../components/page-loading";

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

type MaybeArray<T> = T | T[] | null;
type RawStoreProductRow = Omit<StoreProductRow, "product"> & {
  product: MaybeArray<ProductInfo>;
};

const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function firstOrNull<T>(value: MaybeArray<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeStoreProductRow(row: RawStoreProductRow): StoreProductRow {
  return {
    ...row,
    product: firstOrNull(row.product),
  };
}

function validateProductImage(file: File) {
  if (!ALLOWED_PRODUCT_IMAGE_EXTENSIONS[file.type]) {
    return "La imagen debe ser JPG, PNG o WebP.";
  }

  if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
    return "La imagen no debe superar los 5 MB.";
  }

  return null;
}

export default function MerchantProductsPage() {
  const supabase = useMemo(() => createClient(), []);
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

  const loadStoreProducts = useCallback(
    async (currentStoreId: string) => {
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

      setProducts((data ?? []).map(normalizeStoreProductRow));
    },
    [supabase]
  );

  const loadInitialData = useCallback(async () => {
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
  }, [loadStoreProducts, router, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInitialData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadInitialData]);

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

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] ?? null;

    if (!selectedFile) {
      setImageFile(null);
      return;
    }

    const imageError = validateProductImage(selectedFile);

    if (imageError) {
      setImageFile(null);
      setMessage(imageError);
      e.target.value = "";
      return;
    }

    setImageFile(selectedFile);
    setMessage("");
  }

  async function uploadImageIfNeeded() {
    if (!imageFile) return currentImageUrl || null;

    const imageError = validateProductImage(imageFile);

    if (imageError) {
      throw new Error(imageError);
    }

    const fileExt = ALLOWED_PRODUCT_IMAGE_EXTENSIONS[imageFile.type];
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, imageFile, {
        upsert: false,
        contentType: imageFile.type,
      });

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
        const { data: createdProduct, error: productInsertError } =
          await supabase
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
    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este producto de tu tienda?"
    );
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
    return <PageLoading label="Cargando productos" />;
  }

  return (
    <main className="app-page">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[420px_1fr]">
        <section className="app-card h-fit p-4 shadow-lg sm:p-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="page-title text-2xl">
                {editingStoreProductId ? "Editar producto" : "Nuevo producto"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                Agrega productos, precios, stock e imagen.
              </p>
            </div>

            <Link href="/dashboard" className="btn-soft px-4 py-2 text-sm">
              <ArrowLeft size={17} />
              Volver
            </Link>
          </div>

          {message && (
            <div className="mb-4">
              <Notice
                type={
                  message.toLowerCase().includes("correctamente")
                    ? "success"
                    : message.toLowerCase().includes("eliminado")
                    ? "warning"
                    : "error"
                }
                message={message}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block small-label">Nombre del producto</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                className="app-input"
              />
            </div>

            <div>
              <label className="mb-2 block small-label">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="app-input"
              />
            </div>

            <div>
              <label className="mb-2 block small-label">Marca</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="app-input"
              />
            </div>

            <div>
              <label className="mb-2 block small-label">Categoría</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="app-input"
              >
                <option value="">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block small-label">Precio</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="app-input"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">Stock</label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  required
                  className="app-input"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block small-label">Imagen</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageFileChange}
                className="app-input"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {editingStoreProductId ? <Save size={18} /> : <Plus size={18} />}
                {saving
                  ? "Guardando..."
                  : editingStoreProductId
                  ? "Actualizar producto"
                  : "Crear producto"}
              </button>

              {editingStoreProductId && (
                <button type="button" onClick={resetForm} className="btn-soft">
                  <X size={18} />
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="app-card p-4 shadow-lg sm:p-6">
          <h2 className="section-title text-xl sm:text-2xl">Productos registrados</h2>

          {products.length === 0 ? (
            <div className="info-box mt-4">
              Aún no tienes productos registrados.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {products.map((item) => (
                <article key={item.id} className="app-card-soft p-4 sm:p-5">
                  {item.image_url ? (
                    <div className="mb-4 flex h-44 w-full items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[#eef2f7]">
                      <Image
                        src={item.image_url}
                        alt={item.product?.product_name ?? "Producto"}
                        width={400}
                        height={220}
                        className="h-full w-full object-contain p-2"
                      />
                    </div>
                  ) : (
                    <div className="mb-4 flex h-44 items-center justify-center rounded-2xl bg-[#eef2f7] text-sm text-muted">
                      Sin imagen
                    </div>
                  )}

                  <h3 className="section-title break-words text-xl">
                    {item.product?.product_name ?? "Producto"}
                  </h3>

                  <p className="mt-2 break-words text-sm leading-7 text-muted">
                    {item.product?.description || "Sin descripción"}
                  </p>

                  <div className="mt-3 space-y-1 break-words text-sm text-muted">
                    <p>Marca: {item.product?.brand || "Sin marca"}</p>
                    <p>Precio: S/ {Number(item.price).toFixed(2)}</p>
                    <p>Stock: {item.stock}</p>
                    <p>Estado: {item.is_available ? "Disponible" : "No disponible"}</p>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => handleEdit(item)}
                      className="btn-secondary"
                    >
                      <Pencil size={17} />
                      Editar
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="btn-danger"
                    >
                      <Trash2 size={17} />
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
