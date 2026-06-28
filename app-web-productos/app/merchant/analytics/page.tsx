"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Download,
  Eye,
  PackageCheck,
  PackagePlus,
  Percent,
  ReceiptText,
  RefreshCw,
  Settings,
  ShoppingBag,
  Store,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "../../../lib/supabase/client";
import PageLoading from "../../../components/page-loading";
import Notice from "../../../components/notice";
import DatePicker from "../../../components/date-picker";

type AnalyticsData = {
  store_views: number;
  product_views: number;
  reservations: number;
  estimated_revenue: number;
  cancelled: number;
  daily_series: Array<{ day: string; visits: number; reservations: number }>;
  top_products: Array<{ product_name: string; quantity: number; amount: number }>;
  peak_hours: Array<{ hour: number; reservations: number }>;
  calendar: Array<{
    id: string;
    pickup_code: string;
    status: string;
    total_amount: number;
    pickup_at: string;
  }>;
};

type MerchantSetupStatus = {
  userRole: string | null;
  businessId: string | null;
  storeId: string | null;
  storeName: string | null;
  storeStatus: string | null;
  storeIsActive: boolean;
  productCount: number;
  reservationCount: number;
  completedReservationCount: number;
  completedUnits: number;
};

type RawMerchantSetupStatus = {
  user_role: string | null;
  business_id: string | null;
  store_id: string | null;
  store_name: string | null;
  store_status: string | null;
  store_is_active: boolean | null;
  product_count: number | string | null;
  reservation_count: number | string | null;
  completed_reservation_count: number | string | null;
  completed_units: number | string | null;
};

type SetupIssue =
  | "migration"
  | "technical"
  | "wrong-role"
  | "missing-business"
  | "missing-store";

const emptyAnalytics: AnalyticsData = {
  store_views: 0,
  product_views: 0,
  reservations: 0,
  estimated_revenue: 0,
  cancelled: 0,
  daily_series: [],
  top_products: [],
  peak_hours: [],
  calendar: [],
};

function isoDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function normalizeSetupStatus(row: RawMerchantSetupStatus): MerchantSetupStatus {
  return {
    userRole: row.user_role,
    businessId: row.business_id,
    storeId: row.store_id,
    storeName: row.store_name,
    storeStatus: row.store_status,
    storeIsActive: row.store_is_active === true,
    productCount: Number(row.product_count ?? 0),
    reservationCount: Number(row.reservation_count ?? 0),
    completedReservationCount: Number(row.completed_reservation_count ?? 0),
    completedUnits: Number(row.completed_units ?? 0),
  };
}

function isMissingRpcError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("get_my_merchant_setup_status") ||
    message.includes("schema cache")
  );
}

export default function MerchantAnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [setupLoading, setSetupLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState<MerchantSetupStatus | null>(
    null
  );
  const [setupSource, setSetupSource] = useState<"rpc" | "server">("rpc");
  const [setupIssue, setSetupIssue] = useState<SetupIssue | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [from, setFrom] = useState(() => isoDate(29));
  const [to, setTo] = useState(() => isoDate(0));
  const [analytics, setAnalytics] = useState(emptyAnalytics);

  const loadSetupStatus = useCallback(async () => {
    setSetupLoading(true);
    setSetupIssue(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.replace("/auth/sign-in?next=/merchant/analytics");
      return;
    }

    const { data, error } = await supabase.rpc(
      "get_my_merchant_setup_status"
    );

    if (error) {
      if (!isMissingRpcError(error)) {
        console.error(
          "No se pudo validar la configuración del vendedor.",
          error
        );
        setSetupIssue("technical");
        setSetupLoading(false);
        return;
      }

      const response = await fetch("/api/merchant/setup-status", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const responseBody = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        console.error(
          "No se pudo usar el diagnóstico seguro del vendedor.",
          response.status,
          responseBody?.error
        );
        setSetupIssue(response.status === 503 ? "migration" : "technical");
        setSetupLoading(false);
        return;
      }

      const fallbackRow =
        (await response.json()) as RawMerchantSetupStatus;
      const fallbackStatus = normalizeSetupStatus(fallbackRow);
      setSetupSource("server");
      setSetupStatus(fallbackStatus);

      if (
        fallbackStatus.userRole !== "merchant" &&
        fallbackStatus.userRole !== "admin"
      ) {
        setSetupIssue("wrong-role");
      } else if (!fallbackStatus.businessId) {
        setSetupIssue("missing-business");
      } else if (!fallbackStatus.storeId) {
        setSetupIssue("missing-store");
      }

      setSetupLoading(false);
      return;
    }

    const rawRow = Array.isArray(data) ? data[0] : data;

    if (!rawRow) {
      setSetupIssue("technical");
      setSetupLoading(false);
      return;
    }

    const status = normalizeSetupStatus(
      rawRow as RawMerchantSetupStatus
    );
    setSetupSource("rpc");
    setSetupStatus(status);

    if (status.userRole !== "merchant" && status.userRole !== "admin") {
      setSetupIssue("wrong-role");
    } else if (!status.businessId) {
      setSetupIssue("missing-business");
    } else if (!status.storeId) {
      setSetupIssue("missing-store");
    }

    setSetupLoading(false);
  }, [router, supabase]);

  const loadAnalytics = useCallback(
    async (
      storeId: string,
      start: string,
      end: string,
      source: "rpc" | "server"
    ) => {
      setAnalyticsLoading(true);
      setAnalyticsError("");

      const fromIso = new Date(`${start}T00:00:00-05:00`).toISOString();
      const toDate = new Date(`${end}T00:00:00-05:00`);
      toDate.setDate(toDate.getDate() + 1);

      let data: AnalyticsData | null = null;
      let error: { code?: string; message: string } | null = null;

      if (source === "server") {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          error = { message: "La sesión ha expirado." };
        } else {
          const params = new URLSearchParams({
            from: fromIso,
            to: toDate.toISOString(),
          });
          const response = await fetch(
            `/api/merchant/analytics?${params.toString()}`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            }
          );

          if (response.ok) {
            data = (await response.json()) as AnalyticsData;
          } else {
            const responseBody = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            error = {
              message:
                responseBody?.error ??
                "No se pudieron calcular las métricas.",
            };
          }
        }
      } else {
        const rpcResponse = await supabase.rpc("get_merchant_analytics", {
          p_store_id: storeId,
          p_from: fromIso,
          p_to: toDate.toISOString(),
        });
        data = rpcResponse.data as AnalyticsData | null;
        error = rpcResponse.error;
      }

      if (error) {
        console.error("No se pudieron cargar las métricas de la tienda.", error);
        setAnalyticsError(
          isMissingRpcError(error)
            ? "La migración de analítica todavía no está activa en Supabase."
            : "No pudimos cargar las métricas en este momento. Intenta nuevamente."
        );
      } else {
        setAnalytics({ ...emptyAnalytics, ...(data ?? {}) });
      }

      setAnalyticsLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSetupStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSetupStatus]);

  useEffect(() => {
    if (!setupStatus?.storeId || setupIssue) return;

    const timer = window.setTimeout(() => {
      void loadAnalytics(setupStatus.storeId!, from, to, setupSource);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    from,
    loadAnalytics,
    setupIssue,
    setupSource,
    setupStatus?.storeId,
    to,
  ]);

  async function exportCsv() {
    if (!setupStatus?.storeId) return;

    const toDate = new Date(`${to}T00:00:00-05:00`);
    toDate.setDate(toDate.getDate() + 1);
    const { data, error } = await supabase.rpc(
      "get_merchant_reservation_report",
      {
        p_store_id: setupStatus.storeId,
        p_from: new Date(`${from}T00:00:00-05:00`).toISOString(),
        p_to: toDate.toISOString(),
      }
    );

    if (error) {
      console.error("No se pudo exportar el reporte de reservas.", error);
      setAnalyticsError(
        "No pudimos preparar el archivo CSV. Intenta nuevamente."
      );
      return;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const headers = [
      "reservation_id",
      "pickup_code",
      "status",
      "reserved_at",
      "pickup_at",
      "product_name",
      "quantity",
      "unit_price",
      "subtotal",
      "total_amount",
    ];
    const escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((key) => escape(row[key])).join(",")
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ahorrape-reservas-${from}-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (setupLoading) {
    return <PageLoading label="Verificando tu tienda" />;
  }

  if (setupIssue) {
    return (
      <AnalyticsShell>
        <SetupGate
          issue={setupIssue}
          status={setupStatus}
          onRetry={() => void loadSetupStatus()}
        />
      </AnalyticsShell>
    );
  }

  if (!setupStatus?.storeId) {
    return (
      <AnalyticsShell>
        <SetupGate
          issue="technical"
          status={setupStatus}
          onRetry={() => void loadSetupStatus()}
        />
      </AnalyticsShell>
    );
  }

  const conversion =
    analytics.store_views > 0
      ? (analytics.reservations / analytics.store_views) * 100
      : 0;
  const cancellation =
    analytics.reservations > 0
      ? (analytics.cancelled / analytics.reservations) * 100
      : 0;

  return (
    <AnalyticsShell
      actions={
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <DatePicker
            label="Desde"
            value={from}
            onChange={(nextValue) => {
              setFrom(nextValue);
              if (to < nextValue) setTo(nextValue);
            }}
            today={isoDate(0)}
            className="sm:w-56"
          />
          <DatePicker
            label="Hasta"
            value={to}
            min={from}
            onChange={setTo}
            today={isoDate(0)}
            align="right"
            className="sm:w-56"
          />
          <button
            type="button"
            onClick={exportCsv}
            disabled={analyticsLoading || Boolean(analyticsError)}
            className="btn-soft disabled:opacity-50"
          >
            <Download size={18} />
            CSV
          </button>
        </div>
      }
    >
      <MerchantProgress status={setupStatus} analyticsReady={!analyticsLoading && !analyticsError} />

      {!setupStatus.storeIsActive || setupStatus.storeStatus !== "active" ? (
        <div className="mt-5">
          <Notice
            type="warning"
            message="Tu tienda existe, pero no está publicada como activa. Puedes revisar su configuración antes de compartirla con clientes."
          />
        </div>
      ) : null}

      {setupStatus.productCount === 0 ? (
        <EmptyGuidance
          title="Publica tu primer producto"
          message="La analítica ya está disponible, pero todavía no hay productos para recibir visitas o reservas."
          href="/merchant/products"
          action="Agregar producto"
        />
      ) : setupStatus.reservationCount === 0 ? (
        <EmptyGuidance
          title="Tu tienda ya puede recibir reservas"
          message="Comparte tu tienda y mantén precio, stock y horarios actualizados. Las visitas aparecerán aquí conforme los clientes la exploren."
          href="/merchant/products"
          action="Revisar catálogo"
        />
      ) : setupStatus.completedReservationCount === 0 ? (
        <EmptyGuidance
          title="Todavía no hay reservas completadas"
          message="Los ingresos estimados y productos vendidos aparecerán cuando marques una entrega como completada. AhorraPe no procesa pagos."
          href="/merchant/reservations"
          action="Gestionar reservas"
        />
      ) : null}

      {analyticsError ? (
        <section className="app-card mt-6 p-5 sm:p-6">
          <Notice type="error" message={analyticsError} />
          <button
            type="button"
            onClick={() =>
              void loadAnalytics(
                setupStatus.storeId!,
                from,
                to,
                setupSource
              )
            }
            className="btn-soft mt-4"
          >
            <RefreshCw size={17} />
            Reintentar
          </button>
        </section>
      ) : analyticsLoading ? (
        <AnalyticsSkeleton />
      ) : (
        <div id="metricas">
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Metric icon={Eye} label="Visitas" value={analytics.store_views} />
            <Metric
              icon={ReceiptText}
              label="Reservas"
              value={analytics.reservations}
            />
            <Metric
              icon={PackageCheck}
              label="Productos entregados"
              value={setupStatus.completedUnits}
            />
            <Metric
              icon={WalletCards}
              label="Ingresos estimados"
              value={`S/ ${Number(analytics.estimated_revenue).toFixed(2)}`}
            />
            <Metric
              icon={Percent}
              label="Conversión"
              value={`${conversion.toFixed(1)}%`}
            />
            <Metric
              icon={Percent}
              label="Cancelación"
              value={`${cancellation.toFixed(1)}%`}
            />
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <ChartCard title="Visitas y reservas por día">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.daily_series}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(value) => String(value).slice(5)}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="visits"
                    name="Visitas"
                    stroke="#7900f3"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="reservations"
                    name="Reservas"
                    stroke="#00647a"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Productos entregados">
              {analytics.top_products.length === 0 ? (
                <ChartEmpty message="Aún no hay productos de reservas completadas en este rango." />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={analytics.top_products}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="product_name"
                      width={110}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="quantity"
                      name="Unidades"
                      fill="#7900f3"
                      radius={[0, 5, 5, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Horas pico">
              {analytics.peak_hours.length === 0 ? (
                <ChartEmpty message="Las horas con más recojos aparecerán cuando existan reservas en el rango." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analytics.peak_hours}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(value) => `${value}:00`}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(value) => `${value}:00`} />
                    <Bar
                      dataKey="reservations"
                      name="Reservas"
                      fill="#00647a"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <section className="app-card p-5">
              <h2 className="section-title flex items-center gap-2 text-xl">
                <CalendarDays size={20} />
                Próximos recojos
              </h2>
              <div className="scrollbar-none mt-4 max-h-[260px] space-y-2 overflow-y-auto">
                {analytics.calendar.length === 0 ? (
                  <p className="text-sm text-muted">
                    No hay recojos en el rango seleccionado.
                  </p>
                ) : (
                  analytics.calendar.map((item) => (
                    <Link
                      key={item.id}
                      href={`/merchant/reservations?reservation=${item.id}`}
                      className="block rounded-lg bg-[var(--surface-high)] p-3 hover:ring-1 hover:ring-[var(--primary)]"
                    >
                      <div className="flex justify-between gap-3 text-sm">
                        <strong>{item.pickup_code}</strong>
                        <span>
                          S/ {Number(item.total_amount).toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {new Date(item.pickup_at).toLocaleString("es-PE")} ·{" "}
                        {item.status}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </AnalyticsShell>
  );
}

function AnalyticsShell({
  actions,
  children,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="app-page">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="link-primary inline-flex items-center gap-2 text-sm"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>
            <h1 className="page-title mt-3 text-3xl">
              Analítica de la tienda
            </h1>
            <p className="mt-2 text-muted">
              Datos agregados para entender visitas, reservas e inventario.
            </p>
          </div>
          {actions}
        </div>
        {children}
      </div>
    </main>
  );
}

function SetupGate({
  issue,
  status,
  onRetry,
}: {
  issue: SetupIssue;
  status: MerchantSetupStatus | null;
  onRetry: () => void;
}) {
  const content: Record<
    SetupIssue,
    { title: string; message: string; href?: string; action?: string }
  > = {
    migration: {
      title: "Falta activar la analítica en Supabase",
      message:
        "Tu cuenta no pudo comprobarse porque la función segura de analítica todavía no está instalada. El administrador debe ejecutar supabase/fix_merchant_analytics_access.sql.",
    },
    technical: {
      title: "No pudimos verificar tu tienda",
      message:
        "Ocurrió un problema temporal al validar la asociación de tu cuenta. Tus datos no fueron modificados.",
    },
    "wrong-role": {
      title: "Esta sección es para vendedores",
      message:
        "La cuenta actual no tiene rol de vendedor. Puedes revisar el tipo de cuenta desde tu perfil.",
      href: "/profile",
      action: "Ver perfil",
    },
    "missing-business": {
      title: "Completa los datos del propietario",
      message:
        "Tu cuenta de vendedor todavía no tiene un negocio asociado. Completa la configuración para habilitar la analítica.",
      href: "/merchant/setup",
      action: "Configurar tienda",
    },
    "missing-store": {
      title: "Termina de registrar tu tienda",
      message:
        "Encontramos los datos del propietario, pero todavía falta guardar el local, su ubicación y horario.",
      href: "/merchant/setup",
      action: "Completar tienda",
    },
  };
  const selected = content[issue];

  return (
    <section className="app-card mt-6 overflow-hidden">
      <div className="border-b border-[var(--border)] p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <TriangleAlert size={22} />
          </div>
          <div>
            <h2 className="section-title text-xl">{selected.title}</h2>
            <p className="mt-2 max-w-2xl leading-6 text-muted">
              {selected.message}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {selected.href && selected.action ? (
                <Link href={selected.href} className="btn-primary">
                  {selected.action}
                  <ChevronRight size={17} />
                </Link>
              ) : null}
              {(issue === "technical" || issue === "migration") && (
                <button type="button" onClick={onRetry} className="btn-soft">
                  <RefreshCw size={17} />
                  Verificar nuevamente
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {(issue === "missing-business" || issue === "missing-store") && (
        <div className="p-5 sm:p-7">
          <MerchantProgress
            status={
              status ?? {
                userRole: "merchant",
                businessId: null,
                storeId: null,
                storeName: null,
                storeStatus: null,
                storeIsActive: false,
                productCount: 0,
                reservationCount: 0,
                completedReservationCount: 0,
                completedUnits: 0,
              }
            }
            analyticsReady={false}
            embedded
          />
        </div>
      )}
    </section>
  );
}

function MerchantProgress({
  status,
  analyticsReady,
  embedded = false,
}: {
  status: MerchantSetupStatus;
  analyticsReady: boolean;
  embedded?: boolean;
}) {
  const steps: Array<{
    label: string;
    description: string;
    href: string;
    completed: boolean;
    icon: LucideIcon;
  }> = [
    {
      label: "Configurar propietario y tienda",
      description: status.storeId
        ? status.storeName || "Tienda registrada"
        : "Completa datos, ubicación y horario",
      href: "/merchant/setup",
      completed: Boolean(status.businessId && status.storeId),
      icon: Store,
    },
    {
      label: "Publicar al menos un producto",
      description: `${status.productCount} producto${
        status.productCount === 1 ? "" : "s"
      } registrado${status.productCount === 1 ? "" : "s"}`,
      href: "/merchant/products",
      completed: status.productCount > 0,
      icon: PackagePlus,
    },
    {
      label: "Recibir una reserva",
      description: `${status.reservationCount} reserva${
        status.reservationCount === 1 ? "" : "s"
      } recibida${status.reservationCount === 1 ? "" : "s"}`,
      href: "/merchant/reservations",
      completed: status.reservationCount > 0,
      icon: ShoppingBag,
    },
    {
      label: "Completar una entrega",
      description: `${status.completedReservationCount} reserva${
        status.completedReservationCount === 1 ? "" : "s"
      } completada${status.completedReservationCount === 1 ? "" : "s"}`,
      href: "/merchant/reservations",
      completed: status.completedReservationCount > 0,
      icon: BadgeCheck,
    },
    {
      label: "Revisar métricas y exportar CSV",
      description: analyticsReady
        ? "Panel disponible"
        : "Disponible al verificar la tienda",
      href: "#metricas",
      completed: analyticsReady,
      icon: BarChart3,
    },
  ];
  const completed = steps.filter((step) => step.completed).length;

  return (
    <section className={embedded ? "" : "app-card mt-6 p-5 sm:p-6"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title text-xl">Guía para tu tienda</h2>
          <p className="mt-1 text-sm text-muted">
            Sigue estos pasos para obtener información más útil.
          </p>
        </div>
        <span className="status-badge bg-[rgba(121,0,243,0.09)] text-[var(--primary)]">
          {completed} de {steps.length}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {steps.map((step) => {
          const Icon = step.icon;
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <Icon
                  size={19}
                  className={
                    step.completed
                      ? "text-[var(--secondary)]"
                      : "text-[var(--muted-soft)]"
                  }
                />
                {step.completed ? (
                  <CheckCircle2
                    size={18}
                    className="text-[var(--secondary)]"
                  />
                ) : (
                  <Circle size={18} className="text-[var(--muted-soft)]" />
                )}
              </div>
              <p className="mt-4 text-sm font-semibold">{step.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {step.description}
              </p>
            </>
          );

          return step.href.startsWith("#") ? (
            <a
              key={step.label}
              href={step.href}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-high)] p-4 transition hover:border-[var(--primary)]"
            >
              {content}
            </a>
          ) : (
            <Link
              key={step.label}
              href={step.href}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-high)] p-4 transition hover:border-[var(--primary)]"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function EmptyGuidance({
  title,
  message,
  href,
  action,
}: {
  title: string;
  message: string;
  href: string;
  action: string;
}) {
  return (
    <section className="mt-5 rounded-lg border border-[rgba(0,100,122,0.2)] bg-[rgba(0,100,122,0.07)] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-[var(--on-surface)]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
            {message}
          </p>
        </div>
        <Link href={href} className="btn-secondary shrink-0">
          {action}
          <ChevronRight size={17} />
        </Link>
      </div>
    </section>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="mt-6 space-y-5" aria-label="Cargando métricas">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton h-80 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="app-card p-4">
      <Icon size={19} className="text-[var(--primary)]" />
      <p className="mt-4 text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="app-card min-w-0 p-5">
      <h2 className="section-title mb-4 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-lg bg-[var(--surface-high)] p-6 text-center">
      <div>
        <Settings className="mx-auto text-[var(--muted-soft)]" />
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted">{message}</p>
      </div>
    </div>
  );
}
