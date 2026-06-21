"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  PackageCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import Notice from "../../../components/notice";
import ReservationStatus, {
  getReservationStatusLabel,
} from "../../../components/reservation-status";
import PageLoading from "../../../components/page-loading";

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
  customer_user_id: string;
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
  reservation_items: ReservationItem[];
};

type CustomerInfo = {
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type MaybeArray<T> = T | T[] | null;
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
type RawReservationRow = Omit<ReservationRow, "reservation_items"> & {
  reservation_items: RawReservationItem[] | null;
};
type MerchantCustomerRow = {
  customer_user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
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
    reservation_items: (row.reservation_items ?? []).map(
      normalizeReservationItem
    ),
  };
}

export default function MerchantReservationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState("");
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [customersById, setCustomersById] = useState<
    Record<string, CustomerInfo>
  >({});
  const [messagesById, setMessagesById] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState<string | null>(
    null
  );
  const [merchantCancelMessage, setMerchantCancelMessage] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [highlightedReservationId, setHighlightedReservationId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHighlightedReservationId(
        new URLSearchParams(window.location.search).get("reservation") ?? ""
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !highlightedReservationId) return;
    document
      .getElementById(`reservation-${highlightedReservationId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedReservationId, loading]);

  useEffect(() => {
    async function loadData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/auth/sign-in");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!profile || profile.role !== "merchant") {
        router.push("/auth/sign-in");
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (businessError || !businessData) {
        setNotice({
          type: "warning",
          message: "Primero debes registrar tu negocio.",
        });
        setLoading(false);
        return;
      }

      const { data: storeData, error: storeError } = await supabase
        .from("stores")
        .select("id")
        .eq("business_id", businessData.id)
        .limit(1)
        .maybeSingle();

      if (storeError || !storeData) {
        setNotice({
          type: "warning",
          message: "Primero debes registrar tu tienda.",
        });
        setLoading(false);
        return;
      }

      setStoreId(storeData.id);

      const { data, error } = await supabase
        .from("reservations")
        .select(`
          id,
          customer_user_id,
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
        .eq("store_id", storeData.id)
        .order("reserved_at", { ascending: false });

      if (error) {
        setNotice({ type: "error", message: error.message });
        setLoading(false);
        return;
      }

      const rows = (data ?? []).map(normalizeReservationRow);
      setReservations(rows);

      const initialMessages: Record<string, string> = {};
      rows.forEach((item) => {
        initialMessages[item.id] = item.merchant_message ?? "";
      });
      setMessagesById(initialMessages);

      const { data: customerRows, error: customerError } = await supabase.rpc(
        "get_merchant_reservation_customers",
        {
          p_store_id: storeData.id,
        }
      );

      if (!customerError && customerRows) {
        const customerMap: Record<string, CustomerInfo> = {};

        const typedCustomerRows = customerRows as MerchantCustomerRow[];

        typedCustomerRows.forEach((row) => {
          customerMap[row.customer_user_id] = {
            full_name: row.full_name ?? null,
            phone: row.phone ?? null,
            email: row.email ?? null,
          };
        });

        setCustomersById(customerMap);
      }

      setLoading(false);
    }

    loadData();
  }, [router, supabase]);

  async function handleChangeStatus(
    reservationId: string,
    newStatus: "confirmed" | "ready" | "completed"
  ) {
    const message = messagesById[reservationId] ?? "";

    const { error } = await supabase.rpc("update_store_reservation_status", {
      p_reservation_id: reservationId,
      p_new_status: newStatus,
      p_message: message || null,
    });

    if (error) {
      setNotice({ type: "error", message: error.message });
      return;
    }

    setReservations((prev) =>
      prev.map((item) =>
        item.id === reservationId
          ? {
              ...item,
              status: newStatus,
              merchant_message: message || item.merchant_message,
            }
          : item
      )
    );

    setNotice({
      type: "success",
      message: `Reserva actualizada a ${getReservationStatusLabel(
        newStatus
      ).toLowerCase()}.`,
    });
  }

  function openCancelModal(reservationId: string) {
    setReservationToCancel(reservationId);
    setMerchantCancelMessage(messagesById[reservationId] ?? "");
    setCancelModalOpen(true);
  }

  async function handleConfirmMerchantCancel() {
    if (!reservationToCancel) return;

    if (!merchantCancelMessage.trim()) {
      setNotice({
        type: "warning",
        message: "Debes escribir un motivo antes de cancelar la reserva.",
      });
      return;
    }

    setCancelLoading(true);

    const { error } = await supabase.rpc("update_store_reservation_status", {
      p_reservation_id: reservationToCancel,
      p_new_status: "cancelled",
      p_message: merchantCancelMessage.trim(),
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
              merchant_message: merchantCancelMessage.trim(),
              cancelled_by: "merchant",
            }
          : item
      )
    );

    setMessagesById((prev) => ({
      ...prev,
      [reservationToCancel]: merchantCancelMessage.trim(),
    }));

    setCancelLoading(false);
    setCancelModalOpen(false);
    setReservationToCancel(null);
    setMerchantCancelMessage("");

    setNotice({
      type: "success",
      message: "La reserva fue cancelada correctamente.",
    });
  }

  if (loading) {
    return <PageLoading label="Cargando reservas del local" />;
  }

  return (
    <main className="app-page">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="page-title text-2xl sm:text-3xl">Reservas del local</h1>
            <p className="mt-2 text-base text-muted">
              Aprueba, marca listo o cancela reservas con un mensaje para el
              cliente.
            </p>
          </div>

          <Link href="/dashboard" className="btn-soft">
            <ArrowLeft size={18} />
            Volver al dashboard
          </Link>
        </div>

        {notice && <Notice type={notice.type} message={notice.message} />}

        {!storeId ? (
          <div className="mt-4 app-card p-4 shadow-lg sm:p-6">
            No se encontró una tienda asociada.
          </div>
        ) : reservations.length === 0 ? (
          <div className="mt-4 app-card p-4 shadow-lg sm:p-6">
            No hay reservas todavía.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {reservations.map((item) => {
              const customer = customersById[item.customer_user_id];

              return (
                <article
                  id={`reservation-${item.id}`}
                  key={item.id}
                  className={`app-card p-4 transition sm:p-6 ${
                    highlightedReservationId === item.id
                      ? "border-[var(--primary)] shadow-[0_12px_34px_rgba(121,0,243,0.16)]"
                      : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h2 className="section-title text-xl">
                        Código de recojo: {item.pickup_code}
                      </h2>
                      <div className="mt-2 space-y-1 text-sm text-muted">
                        <ReservationStatus status={item.status} />
                        <p>Total: S/ {Number(item.total_amount).toFixed(2)}</p>
                        <p>
                          Fecha: {new Date(item.reserved_at).toLocaleString()}
                        </p>
                        <p>
                          Recojo:{" "}
                          {item.pickup_at
                            ? new Date(item.pickup_at).toLocaleString()
                            : "No definido"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 app-card-soft p-4">
                    <p className="text-sm text-muted">Cliente</p>
                    <p className="mt-1 font-semibold text-[var(--on-surface)]">
                      {customer?.full_name || "Cliente sin nombre"}
                    </p>
                    <p className="mt-1 break-words text-sm text-muted">
                      Correo: {customer?.email || "No registrado"}
                    </p>
                    <p className="mt-1 break-words text-sm text-muted">
                      Teléfono: {customer?.phone || "No registrado"}
                    </p>
                  </div>

                  {item.notes && (
                    <div className="mt-4 app-card-soft p-4">
                      <p className="text-sm text-muted">Nota del cliente</p>
                      <p className="mt-1 break-words text-sm text-[var(--on-surface)]">
                        {item.notes}
                      </p>
                    </div>
                  )}

                  {item.customer_cancel_reason && (
                    <div className="mt-4 app-card-soft p-4">
                      <p className="text-sm text-muted">
                        Motivo de cancelación del cliente
                      </p>
                      <p className="mt-1 break-words text-sm text-[var(--on-surface)]">
                        {item.customer_cancel_reason}
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <h3 className="section-title mb-3 text-lg">
                      Productos de la reserva
                    </h3>
                    <div className="space-y-3">
                      {item.reservation_items.map((detail) => (
                        <div key={detail.id} className="app-card-soft p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
                                {detail.store_products?.image_url ? (
                                  <Image
                                    src={detail.store_products.image_url}
                                    alt={
                                      detail.store_products?.products
                                        ?.product_name || "Producto"
                                    }
                                    fill
                                    sizes="64px"
                                    className="object-contain p-1.5"
                                  />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                              <p className="font-semibold text-[var(--on-surface)]">
                                {detail.store_products?.products?.product_name ||
                                  "Producto"}
                              </p>
                              <p className="text-sm text-muted">
                                Marca:{" "}
                                {detail.store_products?.products?.brand ||
                                  "Sin marca"}
                              </p>
                              </div>
                            </div>

                            <div className="text-sm text-muted">
                              <p>Cantidad: {detail.quantity}</p>
                              <p>
                                Precio unitario: S/{" "}
                                {Number(detail.unit_price).toFixed(2)}
                              </p>
                              <p>
                                Subtotal: S/{" "}
                                {Number(detail.subtotal).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block small-label">
                      Mensaje para el cliente
                    </label>
                    <textarea
                      rows={3}
                      value={messagesById[item.id] ?? ""}
                      onChange={(e) =>
                        setMessagesById((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="Ejemplo: tu reserva fue aprobada, puedes recogerla hoy..."
                      className="app-input"
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {item.status === "pending" && (
                      <button
                        onClick={() => handleChangeStatus(item.id, "confirmed")}
                        className="btn-primary"
                      >
                        <Check size={18} />
                        Aprobar
                      </button>
                    )}

                    {(item.status === "pending" ||
                      item.status === "confirmed") && (
                      <button
                        onClick={() => handleChangeStatus(item.id, "ready")}
                        className="btn-secondary"
                      >
                        <PackageCheck size={18} />
                        Marcar listo
                      </button>
                    )}

                    {item.status === "ready" && (
                      <button
                        onClick={() => handleChangeStatus(item.id, "completed")}
                        className="btn-secondary"
                      >
                        <CheckCheck size={18} />
                        Completar entrega
                      </button>
                    )}

                    {item.status !== "completed" &&
                      item.status !== "cancelled" && (
                        <button
                          onClick={() => openCancelModal(item.id)}
                          className="btn-danger"
                        >
                          <XCircle size={18} />
                          Cancelar
                        </button>
                      )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {cancelModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-md app-card max-h-[calc(100vh-2rem)] overflow-y-auto p-5 shadow-xl sm:p-6">
            <h2 className="section-title text-2xl">Cancelar reserva</h2>
            <p className="mt-2 text-sm text-muted">
              Escribe el motivo de cancelación para que el cliente pueda verlo.
            </p>

            <div className="mt-4">
              <label className="mb-2 block small-label">
                Motivo de cancelación
              </label>
              <textarea
                rows={4}
                value={merchantCancelMessage}
                onChange={(e) => setMerchantCancelMessage(e.target.value)}
                placeholder="Ejemplo: el producto ya no está disponible"
                className="app-input"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setCancelModalOpen(false);
                  setReservationToCancel(null);
                  setMerchantCancelMessage("");
                }}
                className="btn-soft flex-1"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={handleConfirmMerchantCancel}
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
