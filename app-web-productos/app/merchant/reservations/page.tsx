"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
};

export default function MerchantReservationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState("");
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [customersById, setCustomersById] = useState<Record<string, CustomerInfo>>(
  {}
);
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

      const rows = (data as ReservationRow[]) ?? [];
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

  (customerRows as any[]).forEach((row) => {
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
      message: `Reserva actualizada a ${newStatus}.`,
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
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        Cargando reservas...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Reservas del local</h1>
            <p className="mt-2 text-gray-400">
              Aprueba, marca listo o cancela reservas con un mensaje para el
              cliente.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-800 px-4 py-2 font-semibold hover:bg-gray-700"
          >
            Volver al dashboard
          </Link>
        </div>

        {notice && <Notice type={notice.type} message={notice.message} />}

        {!storeId ? (
          <div className="mt-4 rounded-2xl bg-gray-900 p-6 shadow-lg">
            No se encontró una tienda asociada.
          </div>
        ) : reservations.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-gray-900 p-6 shadow-lg">
            No hay reservas todavía.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {reservations.map((item) => {
              const customer = customersById[item.customer_user_id];

              return (
                <article
                  key={item.id}
                  className="rounded-2xl bg-gray-900 p-6 shadow-lg"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Código de recojo: {item.pickup_code}
                      </h2>
                      <div className="mt-2 space-y-1 text-sm text-gray-300">
                        <p>
                          Estado:{" "}
                          <span
                            className={`font-semibold ${
                              item.status === "pending"
                                ? "text-yellow-400"
                                : item.status === "confirmed"
                                ? "text-blue-400"
                                : item.status === "ready"
                                ? "text-indigo-400"
                                : item.status === "completed"
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {item.status}
                          </span>
                        </p>
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

                  <div className="mt-4 rounded-xl bg-gray-800 p-4">
  <p className="text-sm text-gray-400">Cliente</p>
  <p className="mt-1 font-semibold text-white">
    {customer?.full_name || "Cliente sin nombre"}
  </p>
  <p className="mt-1 text-sm text-gray-300">
    Correo: {customer?.email || "No registrado"}
  </p>
  <p className="mt-1 text-sm text-gray-300">
    Teléfono: {customer?.phone || "No registrado"}
  </p>
</div>

                  {item.notes && (
                    <div className="mt-4 rounded-xl bg-gray-800 p-4">
                      <p className="text-sm text-gray-400">Nota del cliente</p>
                      <p className="mt-1 text-sm text-white">{item.notes}</p>
                    </div>
                  )}

                  {item.customer_cancel_reason && (
                    <div className="mt-4 rounded-xl bg-gray-800 p-4">
                      <p className="text-sm text-gray-400">
                        Motivo de cancelación del cliente
                      </p>
                      <p className="mt-1 text-sm text-white">
                        {item.customer_cancel_reason}
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <h3 className="mb-3 text-lg font-semibold">
                      Productos de la reserva
                    </h3>
                    <div className="space-y-3">
                      {item.reservation_items.map((detail) => (
                        <div
                          key={detail.id}
                          className="rounded-xl bg-gray-800 p-4"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold">
                                {detail.store_products?.products?.product_name ||
                                  "Producto"}
                              </p>
                              <p className="text-sm text-gray-400">
                                Marca:{" "}
                                {detail.store_products?.products?.brand ||
                                  "Sin marca"}
                              </p>
                            </div>

                            <div className="text-sm text-gray-300">
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
                    <label className="mb-2 block text-sm text-gray-400">
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
                      className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 outline-none"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.status === "pending" && (
                      <button
                        onClick={() => handleChangeStatus(item.id, "confirmed")}
                        className="rounded-lg bg-blue-600 px-4 py-2 font-semibold hover:bg-blue-700"
                      >
                        Aprobar
                      </button>
                    )}

                    {(item.status === "pending" ||
                      item.status === "confirmed") && (
                      <button
                        onClick={() => handleChangeStatus(item.id, "ready")}
                        className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold hover:bg-indigo-700"
                      >
                        Marcar listo
                      </button>
                    )}

                    {item.status === "ready" && (
                      <button
                        onClick={() => handleChangeStatus(item.id, "completed")}
                        className="rounded-lg bg-green-600 px-4 py-2 font-semibold hover:bg-green-700"
                      >
                        Completar entrega
                      </button>
                    )}

                    {item.status !== "completed" &&
                      item.status !== "cancelled" && (
                        <button
                          onClick={() => openCancelModal(item.id)}
                          className="rounded-lg bg-red-600 px-4 py-2 font-semibold hover:bg-red-700"
                        >
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 p-6 shadow-xl">
            <h2 className="text-2xl font-bold">Cancelar reserva</h2>
            <p className="mt-2 text-sm text-gray-400">
              Escribe el motivo de cancelación para que el cliente pueda verlo.
            </p>

            <div className="mt-4">
              <label className="mb-2 block text-sm text-gray-400">
                Motivo de cancelación
              </label>
              <textarea
                rows={4}
                value={merchantCancelMessage}
                onChange={(e) => setMerchantCancelMessage(e.target.value)}
                placeholder="Ejemplo: el producto ya no está disponible"
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 outline-none"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setCancelModalOpen(false);
                  setReservationToCancel(null);
                  setMerchantCancelMessage("");
                }}
                className="flex-1 rounded-lg bg-gray-700 px-4 py-3 font-semibold hover:bg-gray-600"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={handleConfirmMerchantCancel}
                disabled={cancelLoading}
                className="flex-1 rounded-lg bg-red-600 px-4 py-3 font-semibold hover:bg-red-700 disabled:opacity-60"
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