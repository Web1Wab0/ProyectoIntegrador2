"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Download, Eye, Percent, ReceiptText, WalletCards } from "lucide-react";
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

export default function MerchantAnalyticsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState("");
  const [from, setFrom] = useState(() => isoDate(29));
  const [to, setTo] = useState(() => isoDate(0));
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async (id: string, start: string, end: string) => {
    setLoading(true);
    setError("");
    const fromIso = new Date(`${start}T00:00:00-05:00`).toISOString();
    const toDate = new Date(`${end}T00:00:00-05:00`);
    toDate.setDate(toDate.getDate() + 1);
    const { data, error: rpcError } = await supabase.rpc("get_merchant_analytics", {
      p_store_id: id,
      p_from: fromIso,
      p_to: toDate.toISOString(),
    });
    if (rpcError) {
      setError(
        rpcError.code === "PGRST202"
          ? "Ejecuta supabase/comprehensive_expansion.sql para habilitar analítica."
          : rpcError.message
      );
    } else {
      setAnalytics({ ...emptyAnalytics, ...(data as AnalyticsData) });
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth/sign-in?next=/merchant/analytics");
        return;
      }
      const { data: business } = await supabase.from("businesses").select("id").eq("owner_user_id", auth.session.user.id).maybeSingle();
      if (!business) {
        setError("Primero registra tu tienda.");
        setLoading(false);
        return;
      }
      const { data: store } = await supabase.from("stores").select("id").eq("business_id", business.id).maybeSingle();
      if (!store) {
        setError("Primero registra tu tienda.");
        setLoading(false);
        return;
      }
      setStoreId(store.id);
      await loadAnalytics(store.id, from, to);
    })();
  }, [from, loadAnalytics, router, supabase, to]);

  async function exportCsv() {
    const toDate = new Date(`${to}T00:00:00-05:00`);
    toDate.setDate(toDate.getDate() + 1);
    const { data, error: reportError } = await supabase.rpc("get_merchant_reservation_report", {
      p_store_id: storeId,
      p_from: new Date(`${from}T00:00:00-05:00`).toISOString(),
      p_to: toDate.toISOString(),
    });
    if (reportError) {
      setError(reportError.message);
      return;
    }
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const headers = ["reservation_id", "pickup_code", "status", "reserved_at", "pickup_at", "product_name", "quantity", "unit_price", "subtotal", "total_amount"];
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ahorrape-reservas-${from}-${to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const conversion = analytics.store_views > 0 ? (analytics.reservations / analytics.store_views) * 100 : 0;
  const cancellation = analytics.reservations > 0 ? (analytics.cancelled / analytics.reservations) * 100 : 0;

  if (loading && !storeId) return <PageLoading label="Cargando analítica" />;

  return (
    <main className="app-page">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/dashboard" className="link-primary inline-flex items-center gap-2 text-sm"><ArrowLeft size={16} /> Dashboard</Link>
            <h1 className="page-title mt-3 text-3xl">Analítica de la tienda</h1>
            <p className="mt-2 text-muted">Datos agregados para entender visitas, reservas e inventario.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="app-input" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="app-input" />
            <button type="button" onClick={exportCsv} className="btn-soft"><Download size={18} /> CSV</button>
          </div>
        </div>

        {error ? <div className="mt-5"><Notice type="warning" message={error} /></div> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric icon={Eye} label="Visitas" value={analytics.store_views} />
          <Metric icon={ReceiptText} label="Reservas" value={analytics.reservations} />
          <Metric icon={WalletCards} label="Ingresos estimados" value={`S/ ${Number(analytics.estimated_revenue).toFixed(2)}`} />
          <Metric icon={Percent} label="Conversión" value={`${conversion.toFixed(1)}%`} />
          <Metric icon={Percent} label="Cancelación" value={`${cancellation.toFixed(1)}%`} />
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <ChartCard title="Visitas y reservas por día">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.daily_series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tickFormatter={(value) => String(value).slice(5)} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="visits" name="Visitas" stroke="#7900f3" strokeWidth={2} />
                <Line type="monotone" dataKey="reservations" name="Reservas" stroke="#00647a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Productos más reservados">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.top_products} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="product_name" width={110} />
                <Tooltip />
                <Bar dataKey="quantity" name="Unidades" fill="#7900f3" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Horas pico">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.peak_hours}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hour" tickFormatter={(value) => `${value}:00`} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(value) => `${value}:00`} />
                <Bar dataKey="reservations" name="Reservas" fill="#00647a" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <section className="app-card p-5">
            <h2 className="section-title flex items-center gap-2 text-xl"><CalendarDays size={20} /> Próximos recojos</h2>
            <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto">
              {analytics.calendar.length === 0 ? <p className="text-sm text-muted">No hay recojos en el rango.</p> : analytics.calendar.map((item) => (
                <Link key={item.id} href={`/merchant/reservations?reservation=${item.id}`} className="block rounded-lg bg-[var(--surface-high)] p-3 hover:ring-1 hover:ring-[var(--primary)]">
                  <div className="flex justify-between gap-3 text-sm">
                    <strong>{item.pickup_code}</strong>
                    <span>S/ {Number(item.total_amount).toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{new Date(item.pickup_at).toLocaleString("es-PE")} · {item.status}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string | number }) {
  return (
    <div className="app-card p-4">
      <Icon size={19} className="text-[var(--primary)]" />
      <p className="mt-4 text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="app-card min-w-0 p-5"><h2 className="section-title mb-4 text-xl">{title}</h2>{children}</section>;
}
