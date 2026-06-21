"use client";

import { Heart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";
import { recordStoreEvent } from "../lib/analytics";
import { useToast } from "./toast-provider";

type FavoriteButtonProps =
  | { kind: "store"; id: string; storeId: string; className?: string }
  | { kind: "product"; id: string; storeId: string; className?: string };

export default function FavoriteButton(props: FavoriteButtonProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      const nextUserId = data.session?.user.id ?? null;
      if (!mounted) return;
      setUserId(nextUserId);
      if (!nextUserId) return;

      const table = props.kind === "store" ? "favorite_stores" : "favorite_products";
      const column = props.kind === "store" ? "store_id" : "store_product_id";
      const { data: row } = await supabase
        .from(table)
        .select(column)
        .eq("user_id", nextUserId)
        .eq(column, props.id)
        .maybeSingle();

      if (mounted) setFavorite(Boolean(row));
    });

    return () => {
      mounted = false;
    };
  }, [props.id, props.kind, supabase]);

  async function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!userId) {
      router.push(`/auth/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setBusy(true);
    const table = props.kind === "store" ? "favorite_stores" : "favorite_products";
    const column = props.kind === "store" ? "store_id" : "store_product_id";
    const next = !favorite;
    const { error } = next
      ? await supabase.from(table).insert({ user_id: userId, [column]: props.id })
      : await supabase
          .from(table)
          .delete()
          .eq("user_id", userId)
          .eq(column, props.id);

    if (error) {
      showToast({
        type: "error",
        message:
          error.code === "42P01" || error.code === "PGRST205"
            ? "Ejecuta la migración integral de Supabase para habilitar favoritos."
            : error.message,
      });
    } else {
      setFavorite(next);
      showToast({
        type: "success",
        message: next ? "Agregado a favoritos." : "Eliminado de favoritos.",
      });
      if (next) {
        void recordStoreEvent(supabase, {
          eventType: props.kind === "store" ? "favorite_store" : "favorite_product",
          storeId: props.storeId,
          storeProductId: props.kind === "product" ? props.id : null,
        });
      }
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`icon-button border border-[var(--border)] bg-[var(--surface-lowest)] shadow-sm ${props.className ?? ""}`}
      aria-label={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
      title={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
    >
      <Heart
        size={19}
        className={favorite ? "fill-[var(--primary)] text-[var(--primary)]" : ""}
      />
    </button>
  );
}
