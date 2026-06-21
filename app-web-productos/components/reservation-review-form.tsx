"use client";

import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { useToast } from "./toast-provider";

export default function ReservationReviewForm({
  reservationId,
  storeId,
  products,
}: {
  reservationId: string;
  storeId: string;
  products: Array<{ id: string; name: string }>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const [storeRating, setStoreRating] = useState(5);
  const [storeComment, setStoreComment] = useState("");
  const [productRatings, setProductRatings] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  async function saveReviews() {
    setSaving(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setSaving(false);
      return;
    }

    const { error: storeError } = await supabase.from("store_reviews").upsert(
      {
        reservation_id: reservationId,
        store_id: storeId,
        user_id: userId,
        rating: storeRating,
        comment: storeComment.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "reservation_id,user_id" }
    );

    if (storeError) {
      showToast({ type: "error", message: storeError.message });
      setSaving(false);
      return;
    }

    const productRows = products
      .filter((item) => productRatings[item.id])
      .map((item) => ({
        reservation_id: reservationId,
        store_product_id: item.id,
        user_id: userId,
        rating: productRatings[item.id],
        comment: null,
        updated_at: new Date().toISOString(),
      }));

    if (productRows.length) {
      const { error } = await supabase
        .from("product_reviews")
        .upsert(productRows, { onConflict: "reservation_id,store_product_id,user_id" });
      if (error) {
        showToast({ type: "error", message: error.message });
        setSaving(false);
        return;
      }
    }

    showToast({ type: "success", message: "Gracias. Tus reseñas fueron guardadas." });
    setSaving(false);
  }

  return (
    <details className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-high)] p-4">
      <summary className="cursor-pointer font-semibold">Calificar esta compra</summary>
      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold">Tienda</p>
          <StarPicker value={storeRating} onChange={setStoreRating} />
          <textarea
            value={storeComment}
            onChange={(event) => setStoreComment(event.target.value)}
            rows={3}
            className="app-input mt-3"
            placeholder="Cuéntanos cómo fue tu experiencia"
          />
        </div>
        {products.map((product) => (
          <div key={product.id} className="flex flex-col gap-2 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">{product.name}</span>
            <StarPicker
              value={productRatings[product.id] ?? 0}
              onChange={(value) =>
                setProductRatings((current) => ({ ...current, [product.id]: value }))
              }
            />
          </div>
        ))}
        <button type="button" onClick={saveReviews} disabled={saving} className="btn-primary">
          {saving ? "Guardando..." : "Guardar reseña"}
        </button>
      </div>
    </details>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex gap-1" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="rounded p-1 focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          aria-label={`${star} estrellas`}
        >
          <Star
            size={22}
            className={
              star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-[var(--muted-soft)]"
            }
          />
        </button>
      ))}
    </div>
  );
}
