"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import Notice from "../../../components/notice";

type ReservationItem = {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  store_products: {
    image_url: string | null;
    products: {
      product_name: string;
      description: string | null;
      brand: string | null;
    } | null;
  } | null;
};

type ReservationRow = {
  id: string;
  status: string;
  pickup_code: string;
  total_amount: number;
  reserved_at: string;
  expires_at: string | null;
  pickup_at: string | null;
  merchant_message: string | null;
  cancelled_by: string | null;
  customer_cancel_reason: string | null;
  notes: string | null;
  stores: {
    store_name: string;
    address_text: string;
  } | null;
  reservation_items: ReservationItem[];
};

type MaybeArray<T> = T | T[] | null;
type StoreRelation = NonNullable<ReservationRow["stores"]>;
type ProductRelation = NonNullable<
  NonNullable<ReservationItem["store_products"]>["products"]
>;
type StoreProductRelation = Omit<
  NonNullable<ReservationItem["store_products"]>,
  "products"
> & {
  products: MaybeArray<ProductRelation>;
};
type RawReservationItem = Omit<ReservationItem, "store_products"> & {
  store_products: MaybeArray<StoreProductRelation>;
};
type RawReservationRow = Omit<
  ReservationRow,
  "stores" | "reservation_items"
> & {
  stores: MaybeArray<StoreRelation>;
  reservation_items: RawReservationItem[] | null;
};

function firstOrNull<T>(value: MaybeArray<T> | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeReservationItem(item: RawReservationItem): ReservationItem {
  const storeProduct = firstOrNull(item.store_products);

  return {
    ...item,
    store_products: storeProduct
      ? {
          ...storeProduct,
          products: firstOrNull(storeProduct.products),
        }
      : null,
  };
}

function normalizeReservationRow(row: RawReservationRow): ReservationRow {
  return {
    ...row,
    stores: firstOrNull(row.stores),
    reservation_items: (row.reservation_items ?? []).map(
      normalizeReservationItem
    ),
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function CustomerReservationsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadReservations() {
      try {
        let sessionUser: { id: string } | null = null;

        for (let i = 0; i < 4; i++) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            sessionUser = { id: session.user.id };
            break;
          }

          await wait(250);
        }

        if (!mounted) return;

        if (!sessionUser) {
          window.location.href = "/auth/sign-in?next=/customer/reservations";
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", sessionUser.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileError) {
          setNotice({ type: "error", message: profileError.message });
          setLoading(false);
          return;
        }

        if (!profile || profile.role !== "customer") {
          setNotice({
            type: "warning",
            message: "Solo las cuentas de cliente pueden ver esta sección.",
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("reservations")
          .select(`
            id,
            status,
            pickup_code,
            total_amount,
            reserved_at,
            expires_at,
            pickup_at,
            merchant_message,
            cancelled_by,
            customer_cancel_reason,
            notes,
            stores:store_id (
              store_name,
              address_text
            ),
            reservation_items (
              id,
              quantity,
              unit_price,
              subtotal,
              store_products:store_product_id (
                image_url,
                products:product_id (
                  product_name,
                  description,
                  brand
                )
              )
            )
          `)
          .eq("customer_user_id", sessionUser.id)
          .order("reserved_at", { ascending: false });

        if (!mounted) return;

        if (error) {
          setNotice({ type: "error", message: error.message });
          setLoading(false);
          return;
        }

        setReservations((data ?? []).map(normalizeReservationRow));
        setLoading(false);
      } catch {
        if (!mounted) return;
        setNotice({
          type: "error",
          message: "No se pudo cargar tus reservas.",
        });
        setLoading(false);
      }
    }

    loadReservations();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  function openCancelModal(reservationId: string) {
    setReservationToCancel(reservationId);
    setCancelReason("");
    setCancelModalOpen(true);
  }

  async function handleConfirmCancelReservation() {
    if (!reservationToCancel) return;

    setCancelLoading(true);

    const { error } = await supabase.rpc("cancel_own_reservation", {
      p_reservation_id: reservationToCancel,
      p_reason: cancelReason.trim() || null,
    });

    if (error) {
      setNotice({ type: "error", message: error.message });
      setCancelLoading(false);
      return;
    }

    setReservations((prev) =>
      prev.map((item) =>
        item.id === reservationToCancel
          ? {
              ...item,
              status: "cancelled",
              cancelled_by: "customer",
              customer_cancel_reason: cancelReason.trim() || null,
            }
          : item
      )
    );

    setCancelLoading(false);
    setCancelModalOpen(false);
    setReservationToCancel(null);
    setCancelReason("");

    setNotice({
      type: "success",
      message: "La reserva fue cancelada correctamente.",
    });
  }

  if (loading) {
    return (
      <main className="app-page flex items-center justify-center">
        Cargando reservas...
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="page-title text-2xl sm:text-3xl">Mis reservas</h1>
            <p className="mt-2 text-base text-muted">
              Aquí puedes ver el historial de tus reservas, revisar estados y cancelar las que sigan pendientes.
            </p>
          </div>

          <Link href="/" className="btn-soft">
            Volver al inicio
          </Link>
        </div>

        {notice && <Notice type={notice.type} message={notice.message} />}

        {reservations.length === 0 ? (
          <div className="app-card mt-4 p-4 shadow-lg sm:p-6">
            No tienes reservas todavía.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {reservations.map((item) => (
              <article key={item.id} className="app-card p-4 shadow-lg sm:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h2 className="section-title text-xl">
                      {item.stores?.store_name || "Tienda"}
                    </h2>
                    <p className="mt-1 break-words text-sm text-muted">
                      {item.stores?.address_text || "Sin dirección"}
                    </p>
                  </div>

                  <div className="app-card-soft w-full rounded-2xl px-4 py-3 text-sm sm:w-auto">
                    <p>
                      Estado:{" "}
                      <span
                        className={`font-semibold ${
                          item.status === "pending"
                            ? "text-amber-600"
                            : item.status === "confirmed"
                            ? "text-sky-600"
                            : item.status === "ready"
                            ? "text-indigo-600"
                            : item.status === "completed"
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {item.status}
                      </span>
                    </p>
                    <p className="mt-1 break-words text-[var(--on-surface)]">Código: {item.pickup_code}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-2">
                  <p>Total: S/ {Number(item.total_amount).toFixed(2)}</p>
                  <p>Fecha de reserva: {new Date(item.reserved_at).toLocaleString()}</p>
                  <p>
                    Recojo:{" "}
                    {item.pickup_at ? new Date(item.pickup_at).toLocaleString() : "No definido"}
                  </p>
                  <p>
                    Expira:{" "}
                    {item.expires_at ? new Date(item.expires_at).toLocaleString() : "Sin fecha"}
                  </p>
                </div>

                {item.notes && (
                  <div className="app-card-soft mt-4 rounded-2xl p-4">
                    <p className="text-sm text-muted">Nota del cliente</p>
                    <p className="mt-1 break-words text-sm text-[var(--on-surface)]">{item.notes}</p>
                  </div>
                )}

                <div className="mt-4">
                  <h3 className="section-title mb-3 text-lg">Productos de la reserva</h3>
                  <div className="space-y-3">
                    {item.reservation_items.map((detail) => (
                      <div key={detail.id} className="app-card-soft rounded-2xl p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--on-surface)]">
                              {detail.store_products?.products?.product_name || "Producto"}
                            </p>
                            <p className="text-sm text-muted">
                              Marca: {detail.store_products?.products?.brand || "Sin marca"}
                            </p>
                          </div>

                          <div className="text-sm text-muted">
                            <p>Cantidad: {detail.quantity}</p>
                            <p>Precio unitario: S/ {Number(detail.unit_price).toFixed(2)}</p>
                            <p>Subtotal: S/ {Number(detail.subtotal).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {item.merchant_message && (
                  <div className="app-card-soft mt-4 rounded-2xl p-4">
                    <p className="text-sm text-muted">Mensaje del vendedor</p>
                    <p className="mt-1 break-words text-sm text-[var(--on-surface)]">{item.merchant_message}</p>
                  </div>
                )}

                {item.customer_cancel_reason && (
                  <div className="app-card-soft mt-4 rounded-2xl p-4">
                    <p className="text-sm text-muted">Motivo de cancelación</p>
                    <p className="mt-1 break-words text-sm text-[var(--on-surface)]">{item.customer_cancel_reason}</p>
                  </div>
                )}

                {item.cancelled_by && (
                  <p className="mt-3 text-sm text-muted">
                    Cancelada por: {item.cancelled_by}
                  </p>
                )}

                {(item.status === "pending" || item.status === "confirmed") && (
                  <button onClick={() => openCancelModal(item.id)} className="btn-danger mt-4">
                    Cancelar reserva
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {cancelModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="app-card w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-5 shadow-xl sm:p-6">
            <h2 className="section-title text-2xl">Cancelar reserva</h2>
            <p className="mt-2 text-sm text-muted">
              Puedes escribir un motivo opcional antes de cancelar.
            </p>

            <div className="mt-4">
              <label className="mb-2 block small-label">Motivo de cancelación</label>
              <textarea
                rows={4}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ejemplo: ya no podré recogerlo hoy"
                className="app-input"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setCancelModalOpen(false);
                  setReservationToCancel(null);
                  setCancelReason("");
                }}
                className="btn-soft flex-1"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={handleConfirmCancelReservation}
                disabled={cancelLoading}
                className="btn-danger flex-1 disabled:opacity-60"
              >
                {cancelLoading ? "Cancelando..." : "Cancelar reserva"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
