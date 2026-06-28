"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ImageIcon,
  Layers3,
  Package,
  PackageCheck,
  PackagePlus,
  PackageX,
  Pencil,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import PageLoading from "../../../components/page-loading";
import { useToast } from "../../../components/toast-provider";
import NumberStepper from "../../../components/number-stepper";
import CategoryPicker from "../../../components/category-picker";

type Category = {
  id: string;
  name: string;
  is_age_restricted?: boolean;
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
  low_stock_threshold: number;
  created_at: string | null;
  product: ProductInfo | null;
};

type MaybeArray<T> = T | T[] | null;
type RawStoreProductRow = Omit<StoreProductRow, "product"> & {
  product: MaybeArray<ProductInfo>;
};

type SortOption =
  | "recent"
  | "name"
  | "stock-asc"
  | "stock-desc"
  | "price-asc"
  | "price-desc";

const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const FILTER_ALL = "all";
const FILTER_LOW_STOCK = "low-stock";
const FILTER_OUT_OF_STOCK = "out-of-stock";
const UNCATEGORIZED_ID = "uncategorized";

const sortLabels: Record<SortOption, string> = {
  recent: "Más recientes",
  name: "Nombre A-Z",
  "stock-asc": "Menor stock",
  "stock-desc": "Mayor stock",
  "price-asc": "Menor precio",
  "price-desc": "Mayor precio",
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

function categoryFilterValue(categoryId: string | null) {
  return `category:${categoryId ?? UNCATEGORIZED_ID}`;
}

function isLowStock(item: StoreProductRow) {
  return Number(item.stock) <= Number(item.low_stock_threshold ?? 3);
}

function isOutOfStock(item: StoreProductRow) {
  return Number(item.stock) <= 0 || !item.is_available;
}

function money(value: number) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function productSearchText(item: StoreProductRow, categoryName: string) {
  return [
    item.product?.product_name,
    item.product?.brand,
    item.product?.description,
    categoryName,
    money(item.price),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function MerchantProductsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockingMessage, setBlockingMessage] = useState("");

  const [userId, setUserId] = useState("");
  const [storeId, setStoreId] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<StoreProductRow[]>([]);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingStoreProductId, setEditingStoreProductId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("3");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState(FILTER_ALL);
  const [sortOption, setSortOption] = useState<SortOption>("recent");

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => map.set(category.id, category.name));
    return map;
  }, [categories]);

  const stats = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter(isLowStock).length;
    const outOfStock = products.filter(isOutOfStock).length;
    const available = products.filter((item) => !isOutOfStock(item)).length;

    return { total, available, lowStock, outOfStock };
  }, [products]);

  const categoryTabs = useMemo(() => {
    const counters = new Map<string, { id: string | null; name: string; count: number }>();

    products.forEach((item) => {
      const categoryIdForItem = item.product?.category_id ?? null;
      const key = categoryFilterValue(categoryIdForItem);
      const current = counters.get(key);
      const categoryName =
        categoryIdForItem && categoryNameById.has(categoryIdForItem)
          ? categoryNameById.get(categoryIdForItem)!
          : "Sin categoría";

      counters.set(key, {
        id: categoryIdForItem,
        name: current?.name ?? categoryName,
        count: (current?.count ?? 0) + 1,
      });
    });

    return Array.from(counters.entries())
      .map(([filter, value]) => ({ filter, ...value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categoryNameById, products]);

  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    const filtered = products.filter((item) => {
      const itemCategoryName =
        item.product?.category_id && categoryNameById.has(item.product.category_id)
          ? categoryNameById.get(item.product.category_id)!
          : "Sin categoría";

      if (activeFilter === FILTER_LOW_STOCK && !isLowStock(item)) return false;
      if (activeFilter === FILTER_OUT_OF_STOCK && !isOutOfStock(item)) return false;
      if (
        activeFilter.startsWith("category:") &&
        categoryFilterValue(item.product?.category_id ?? null) !== activeFilter
      ) {
        return false;
      }

      if (!search) return true;
      return productSearchText(item, itemCategoryName).includes(search);
    });

    return filtered.sort((a, b) => {
      if (sortOption === "name") {
        return (a.product?.product_name ?? "").localeCompare(
          b.product?.product_name ?? ""
        );
      }

      if (sortOption === "stock-asc") return Number(a.stock) - Number(b.stock);
      if (sortOption === "stock-desc") return Number(b.stock) - Number(a.stock);
      if (sortOption === "price-asc") return Number(a.price) - Number(b.price);
      if (sortOption === "price-desc") return Number(b.price) - Number(a.price);

      return (
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
      );
    });
  }, [activeFilter, categoryNameById, products, searchTerm, sortOption]);

  const loadStoreProducts = useCallback(
    async (currentStoreId: string) => {
      async function queryProducts(includeThreshold: boolean) {
        const fields = includeThreshold
          ? `
            id, price, stock, image_url, is_available, low_stock_threshold, created_at,
            product:products!store_products_product_id_fkey (
              id, product_name, description, brand, category_id
            )
          `
          : `
            id, price, stock, image_url, is_available, created_at,
            product:products!store_products_product_id_fkey (
              id, product_name, description, brand, category_id
            )
          `;
        return supabase
          .from("store_products")
          .select(fields)
          .eq("store_id", currentStoreId)
          .order("created_at", { ascending: false });
      }

      let { data, error } = await queryProducts(true);
      if (error?.message.toLowerCase().includes("low_stock_threshold")) {
        const fallback = await queryProducts(false);
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        showToast({
          type: "error",
          title: "No se pudieron cargar los productos",
          message: error.message,
        });
        return;
      }

      setProducts(
        (((data ?? []) as unknown) as RawStoreProductRow[]).map((row) =>
          normalizeStoreProductRow({
            ...row,
            low_stock_threshold: Number(row.low_stock_threshold ?? 3),
            created_at: row.created_at ?? null,
          })
        )
      );
    },
    [showToast, supabase]
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
      showToast({
        type: "error",
        title: "No se pudo cargar tu negocio",
        message: businessError.message,
      });
      setLoading(false);
      return;
    }

    if (!businessData) {
      setBlockingMessage("Primero debes registrar los datos de tu negocio y tienda.");
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
      showToast({
        type: "error",
        title: "No se pudo cargar tu tienda",
        message: storeError.message,
      });
      setLoading(false);
      return;
    }

    if (!storeData) {
      setBlockingMessage("Primero debes registrar tu tienda.");
      setLoading(false);
      return;
    }

    setStoreId(storeData.id);

    const categoryResponse = await supabase
      .from("categories")
      .select("id, name, is_age_restricted")
      .order("sort_order", { ascending: true });
    let categoriesData: Category[] | null =
      (categoryResponse.data as Category[] | null) ?? null;
    let categoriesError = categoryResponse.error;

    if (categoriesError?.message.toLowerCase().includes("is_age_restricted")) {
      const fallback = await supabase
        .from("categories")
        .select("id, name")
        .order("name", { ascending: true });
      categoriesData = (fallback.data ?? []).map((row) => ({
        ...row,
        is_age_restricted: false,
      }));
      categoriesError = fallback.error;
    }

    if (categoriesError) {
      showToast({
        type: "error",
        title: "No se pudieron cargar las categorías",
        message: categoriesError.message,
      });
      setLoading(false);
      return;
    }

    setCategories(categoriesData ?? []);
    await loadStoreProducts(storeData.id);
    setLoading(false);
  }, [loadStoreProducts, router, showToast, supabase]);

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
    setLowStockThreshold("3");
    setImageFile(null);
    setCurrentImageUrl("");
  }

  function openCreatePanel() {
    resetForm();
    setIsPanelOpen(true);
  }

  function closeProductPanel() {
    setIsPanelOpen(false);
    resetForm();
  }

  function clearFilters() {
    setSearchTerm("");
    setActiveFilter(FILTER_ALL);
    setSortOption("recent");
  }

  function handleImageFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] ?? null;

    if (!selectedFile) {
      setImageFile(null);
      return;
    }

    const imageError = validateProductImage(selectedFile);

    if (imageError) {
      setImageFile(null);
      showToast({
        type: "warning",
        title: "Imagen no válida",
        message: imageError,
      });
      e.target.value = "";
      return;
    }

    setImageFile(selectedFile);
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    if (!storeId) {
      showToast({
        type: "error",
        title: "Tienda no encontrada",
        message: "No se encontró la tienda del local.",
      });
      setSaving(false);
      return;
    }

    const numericPrice = Number(price);
    const numericStock = Number(stock);
    const numericLowStockThreshold = Number(lowStockThreshold);

    if (price.trim() === "" || Number.isNaN(numericPrice) || numericPrice < 0) {
      showToast({
        type: "warning",
        title: "Precio no válido",
        message: "Ingresa un precio mayor o igual a cero.",
      });
      setSaving(false);
      return;
    }

    if (stock.trim() === "" || Number.isNaN(numericStock) || numericStock < 0) {
      showToast({
        type: "warning",
        title: "Stock no válido",
        message: "Ingresa un stock mayor o igual a cero.",
      });
      setSaving(false);
      return;
    }

    if (
      Number.isNaN(numericLowStockThreshold) ||
      numericLowStockThreshold < 0 ||
      numericLowStockThreshold > 9999
    ) {
      showToast({
        type: "warning",
        title: "Umbral no válido",
        message: "El umbral de stock bajo debe estar entre 0 y 9999.",
      });
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
          showToast({
            type: "error",
            title: "No se actualizó el producto",
            message: productUpdateError.message,
          });
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
            low_stock_threshold: numericLowStockThreshold,
          })
          .eq("id", editingStoreProductId);

        if (storeProductUpdateError) {
          showToast({
            type: "error",
            title: "No se actualizó el inventario",
            message: storeProductUpdateError.message,
          });
          setSaving(false);
          return;
        }

        showToast({
          type: "success",
          title: "Producto actualizado",
          message: "Los cambios se guardaron correctamente.",
        });
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
          showToast({
            type: "error",
            title: "No se creó el producto",
            message: productInsertError.message,
          });
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
            low_stock_threshold: numericLowStockThreshold,
          });

        if (storeProductInsertError) {
          showToast({
            type: "error",
            title: "No se agregó a la tienda",
            message: storeProductInsertError.message,
          });
          setSaving(false);
          return;
        }

        showToast({
          type: "success",
          title: "Producto creado",
          message: "El producto ya aparece en tu inventario.",
        });
      }

      setIsPanelOpen(false);
      resetForm();
      await loadStoreProducts(storeId);
    } catch (error) {
      const err = error as Error;
      showToast({
        type: "error",
        title: "No se pudo guardar",
        message: err.message || "Ocurrió un error al subir la imagen.",
      });
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
    setLowStockThreshold(String(item.low_stock_threshold ?? 3));
    setCurrentImageUrl(item.image_url ?? "");
    setImageFile(null);
    setIsPanelOpen(true);
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
      showToast({
        type: "error",
        title: "No se pudo eliminar",
        message: error.message,
      });
      return;
    }

    showToast({
      type: "warning",
      title: "Producto eliminado",
      message: "El producto ya no forma parte de tu tienda.",
    });
    await loadStoreProducts(storeId);
  }

  if (loading) {
    return <PageLoading label="Cargando productos" />;
  }

  if (blockingMessage) {
    return (
      <main className="app-page">
        <section className="mx-auto max-w-3xl app-card p-5 shadow-lg sm:p-7">
          <Link href="/dashboard" className="btn-soft w-fit px-4 py-2 text-sm">
            <ArrowLeft size={17} />
            Volver
          </Link>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0" size={22} />
              <div>
                <h1 className="text-xl font-bold">Inventario no disponible</h1>
                <p className="mt-2 text-sm leading-6">{blockingMessage}</p>
                <Link href="/merchant/setup" className="btn-primary mt-5">
                  Configurar local
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="app-card overflow-hidden shadow-lg">
          <div className="border-b border-[var(--border)] p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <Link
                  href="/dashboard"
                  className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--primary)]"
                >
                  <ArrowLeft size={17} />
                  Volver al panel
                </Link>
                <h1 className="page-title text-3xl sm:text-4xl">
                  Inventario de productos
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                  Gestiona tu catálogo por categoría, stock y precio sin perder
                  de vista lo más importante.
                </p>
              </div>

              <button type="button" onClick={openCreatePanel} className="btn-primary">
                <PackagePlus size={19} />
                Nuevo producto
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-[var(--border)] p-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
            <StatCard
              icon={Package}
              label="Total"
              value={stats.total}
              detail="productos registrados"
            />
            <StatCard
              icon={PackageCheck}
              label="Disponibles"
              value={stats.available}
              detail="con stock activo"
            />
            <StatCard
              icon={AlertTriangle}
              label="Stock bajo"
              value={stats.lowStock}
              detail="requieren atención"
              tone="warning"
            />
            <StatCard
              icon={PackageX}
              label="Sin stock"
              value={stats.outOfStock}
              detail="no se pueden reservar"
              tone="danger"
            />
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative min-w-0">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <span className="sr-only">Buscar producto</span>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por nombre, marca, descripción o categoría"
                  className="app-input pl-11"
                />
              </label>

              <label className="relative min-w-0">
                <SlidersHorizontal
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <span className="sr-only">Ordenar productos</span>
                <select
                  value={sortOption}
                  onChange={(event) => setSortOption(event.target.value as SortOption)}
                  className="app-input pl-11"
                >
                  {Object.entries(sortLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              <FilterButton
                active={activeFilter === FILTER_ALL}
                onClick={() => setActiveFilter(FILTER_ALL)}
              >
                Todos ({products.length})
              </FilterButton>
              <FilterButton
                active={activeFilter === FILTER_LOW_STOCK}
                onClick={() => setActiveFilter(FILTER_LOW_STOCK)}
              >
                Stock bajo ({stats.lowStock})
              </FilterButton>
              <FilterButton
                active={activeFilter === FILTER_OUT_OF_STOCK}
                onClick={() => setActiveFilter(FILTER_OUT_OF_STOCK)}
              >
                Sin stock ({stats.outOfStock})
              </FilterButton>
              {categoryTabs.map((category) => (
                <FilterButton
                  key={category.filter}
                  active={activeFilter === category.filter}
                  onClick={() => setActiveFilter(category.filter)}
                >
                  {category.name} ({category.count})
                </FilterButton>
              ))}
            </div>

            <InventoryList
              products={filteredProducts}
              categoryNameById={categoryNameById}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCreate={openCreatePanel}
              onClearFilters={clearFilters}
              hasProducts={products.length > 0}
            />
          </div>
        </section>
      </div>

      {isPanelOpen ? (
        <ProductDrawer
          editing={Boolean(editingStoreProductId)}
          saving={saving}
          categories={categories}
          productName={productName}
          description={description}
          brand={brand}
          categoryId={categoryId}
          price={price}
          stock={stock}
          lowStockThreshold={lowStockThreshold}
          imageFile={imageFile}
          currentImageUrl={currentImageUrl}
          onProductNameChange={setProductName}
          onDescriptionChange={setDescription}
          onBrandChange={setBrand}
          onCategoryIdChange={setCategoryId}
          onPriceChange={setPrice}
          onStockChange={setStock}
          onLowStockThresholdChange={setLowStockThreshold}
          onImageFileChange={handleImageFileChange}
          onClose={closeProductPanel}
          onSubmit={handleSubmit}
        />
      ) : null}
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: typeof Package;
  label: string;
  value: number;
  detail: string;
  tone?: "default" | "warning" | "danger";
}) {
  const iconClass =
    tone === "warning"
      ? "bg-amber-100 text-amber-700"
      : tone === "danger"
      ? "bg-red-100 text-red-700"
      : "bg-[rgba(121,0,243,0.09)] text-[var(--primary)]";

  return (
    <article className="app-card-soft flex min-w-0 items-center gap-3 p-4">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClass}`}
      >
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-muted">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        <p className="truncate text-xs text-muted">{detail}</p>
      </div>
    </article>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-transparent bg-[var(--primary)] text-white shadow-[0_8px_18px_rgba(121,0,243,0.18)]"
          : "border-[var(--border)] bg-[var(--surface-lowest)] text-[var(--on-surface)] hover:bg-[var(--surface-high)]"
      }`}
    >
      {children}
    </button>
  );
}

function InventoryList({
  products,
  categoryNameById,
  onEdit,
  onDelete,
  onCreate,
  onClearFilters,
  hasProducts,
}: {
  products: StoreProductRow[];
  categoryNameById: Map<string, string>;
  onEdit: (item: StoreProductRow) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onClearFilters: () => void;
  hasProducts: boolean;
}) {
  if (!hasProducts) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-high)] p-8 text-center">
        <PackagePlus className="mx-auto text-[var(--primary)]" size={34} />
        <h2 className="mt-3 text-xl font-bold">Crea tu primer producto</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Agrega nombre, categoría, precio, stock e imagen para que tus clientes
          puedan reservar desde la tienda.
        </p>
        <button type="button" onClick={onCreate} className="btn-primary mt-5">
          <PackagePlus size={18} />
          Nuevo producto
        </button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-high)] p-8 text-center">
        <Search className="mx-auto text-[var(--muted)]" size={34} />
        <h2 className="mt-3 text-xl font-bold">No hay coincidencias</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Ajusta la búsqueda, cambia de categoría o limpia los filtros para ver
          todo tu inventario.
        </p>
        <button type="button" onClick={onClearFilters} className="btn-soft mt-5">
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
      <div className="hidden border-b border-[var(--border)] bg-[var(--surface-high)] px-4 py-3 text-xs font-semibold uppercase text-muted lg:grid lg:grid-cols-[minmax(260px,1.7fr)_130px_110px_110px_130px] lg:items-center lg:gap-4">
        <span>Producto</span>
        <span>Categoría</span>
        <span>Precio</span>
        <span>Stock</span>
        <span className="text-right">Acciones</span>
      </div>

      <div className="scrollbar-none max-h-[72vh] overflow-y-auto bg-[var(--surface-lowest)]">
        {products.map((item) => {
          const categoryName =
            item.product?.category_id && categoryNameById.has(item.product.category_id)
              ? categoryNameById.get(item.product.category_id)!
              : "Sin categoría";

          return (
            <InventoryItem
              key={item.id}
              item={item}
              categoryName={categoryName}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        })}
      </div>
    </div>
  );
}

function InventoryItem({
  item,
  categoryName,
  onEdit,
  onDelete,
}: {
  item: StoreProductRow;
  categoryName: string;
  onEdit: (item: StoreProductRow) => void;
  onDelete: (id: string) => void;
}) {
  const lowStock = isLowStock(item);
  const outOfStock = isOutOfStock(item);
  const statusClass = outOfStock
    ? "bg-red-100 text-red-700"
    : lowStock
    ? "bg-amber-100 text-amber-800"
    : "bg-emerald-100 text-emerald-700";
  const statusLabel = outOfStock ? "Sin stock" : lowStock ? "Stock bajo" : "Disponible";

  return (
    <article className="grid min-w-0 gap-4 border-b border-[var(--border)] p-4 last:border-b-0 lg:grid-cols-[minmax(260px,1.7fr)_130px_110px_110px_130px] lg:items-center">
      <div className="flex min-w-0 gap-3">
        <ProductImage
          src={item.image_url}
          alt={item.product?.product_name ?? "Producto"}
        />
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-semibold leading-6">
            {item.product?.product_name ?? "Producto"}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">
            {item.product?.description || "Sin descripción"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
            {item.product?.brand ? (
              <span className="status-badge bg-[var(--surface-high)] text-[var(--muted)]">
                {item.product.brand}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm lg:block">
        <span className="text-muted lg:hidden">Categoría:</span>
        <span className="font-semibold">{categoryName}</span>
      </div>

      <div className="flex items-center gap-2 text-sm lg:block">
        <span className="text-muted lg:hidden">Precio:</span>
        <span className="font-semibold">{money(item.price)}</span>
      </div>

      <div className="flex items-center gap-2 text-sm lg:block">
        <span className="text-muted lg:hidden">Stock:</span>
        <div>
          <span className="font-semibold">{item.stock}</span>
          <p className="text-xs text-muted">Aviso en {item.low_stock_threshold}</p>
        </div>
      </div>

      <div className="flex gap-2 lg:justify-end">
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="icon-button border border-[var(--border)]"
          aria-label={`Editar ${item.product?.product_name ?? "producto"}`}
          title="Editar"
        >
          <Pencil size={18} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="icon-button border border-red-100 text-[var(--danger)] hover:bg-red-50"
          aria-label={`Eliminar ${item.product?.product_name ?? "producto"}`}
          title="Eliminar"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </article>
  );
}

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-high)] text-[var(--muted)]">
        <ImageIcon size={22} />
      </div>
    );
  }

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[#eef2f7]">
      <Image
        src={src}
        alt={alt}
        width={160}
        height={160}
        className="h-full w-full object-contain p-1.5"
      />
    </div>
  );
}

function ProductDrawer({
  editing,
  saving,
  categories,
  productName,
  description,
  brand,
  categoryId,
  price,
  stock,
  lowStockThreshold,
  imageFile,
  currentImageUrl,
  onProductNameChange,
  onDescriptionChange,
  onBrandChange,
  onCategoryIdChange,
  onPriceChange,
  onStockChange,
  onLowStockThresholdChange,
  onImageFileChange,
  onClose,
  onSubmit,
}: {
  editing: boolean;
  saving: boolean;
  categories: Category[];
  productName: string;
  description: string;
  brand: string;
  categoryId: string;
  price: string;
  stock: string;
  lowStockThreshold: string;
  imageFile: File | null;
  currentImageUrl: string;
  onProductNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onCategoryIdChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onStockChange: (value: string) => void;
  onLowStockThresholdChange: (value: string) => void;
  onImageFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-[10040] flex justify-end">
      <button
        type="button"
        className="motion-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Cerrar panel"
        onClick={onClose}
      />

      <aside className="motion-sheet relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-[var(--surface-lowest)] shadow-[var(--shadow-elevated)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[var(--primary)]">
              Inventario
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {editing ? "Editar producto" : "Nuevo producto"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Completa los datos que verá el cliente al reservar.
            </p>
          </div>
          <button type="button" onClick={onClose} className="icon-button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="scrollbar-none min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            <section className="app-card-soft p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={20}
                  className="mt-0.5 shrink-0 text-[var(--secondary)]"
                />
                <div className="text-sm leading-6 text-muted">
                  <p className="font-semibold text-[var(--on-surface)]">
                    Requisitos rápidos
                  </p>
                  <p>
                    Nombre, precio y stock son obligatorios. Las imágenes deben
                    ser JPG, PNG o WebP y pesar máximo 5 MB.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Layers3 size={19} className="text-[var(--primary)]" />
                <h3 className="font-semibold">Datos básicos</h3>
              </div>

              <div>
                <label className="mb-2 block small-label">
                  Nombre del producto <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(event) => onProductNameChange(event.target.value)}
                  required
                  className="app-input"
                  placeholder="Ejemplo: Arroz extra 5 kg"
                />
              </div>

              <div>
                <label className="mb-2 block small-label">Descripción</label>
                <textarea
                  value={description}
                  onChange={(event) => onDescriptionChange(event.target.value)}
                  rows={4}
                  className="app-input"
                  placeholder="Describe presentación, tamaño o detalle útil."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block small-label">Marca</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(event) => onBrandChange(event.target.value)}
                    className="app-input"
                    placeholder="Opcional"
                  />
                </div>

                <div>
                  <CategoryPicker
                    value={categoryId}
                    onChange={onCategoryIdChange}
                    categories={categories}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <PackageCheck size={19} className="text-[var(--primary)]" />
                <h3 className="font-semibold">Precio y stock</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <NumberStepper
                    label="Precio *"
                    value={price}
                    min={0}
                    step={0.1}
                    precision={2}
                    inputMode="decimal"
                    onChange={onPriceChange}
                  />
                </div>

                <div>
                  <NumberStepper
                    label="Stock *"
                    value={stock}
                    min={0}
                    step={1}
                    onChange={onStockChange}
                  />
                </div>

                <div>
                  <NumberStepper
                    label="Avisar en"
                    max={9999}
                    value={lowStockThreshold}
                    min={0}
                    step={1}
                    onChange={onLowStockThresholdChange}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <ImageIcon size={19} className="text-[var(--primary)]" />
                <h3 className="font-semibold">Imagen del producto</h3>
              </div>

              {currentImageUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-high)] p-3">
                  <ProductImage src={currentImageUrl} alt={productName || "Producto"} />
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">Imagen actual</p>
                    <p className="text-muted">
                      Selecciona otro archivo si deseas reemplazarla.
                    </p>
                  </div>
                </div>
              ) : null}

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onImageFileChange}
                className="app-input"
              />
              {imageFile ? (
                <p className="text-sm text-muted">
                  Archivo seleccionado:{" "}
                  <span className="font-semibold text-[var(--on-surface)]">
                    {imageFile.name}
                  </span>
                </p>
              ) : null}
            </section>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--border)] p-4 sm:flex-row sm:p-6">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 disabled:opacity-60"
            >
              {editing ? <Save size={18} /> : <PackagePlus size={18} />}
              {saving
                ? "Guardando..."
                : editing
                ? "Actualizar producto"
                : "Crear producto"}
            </button>
            <button type="button" onClick={onClose} className="btn-soft">
              <X size={18} />
              Cancelar
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
