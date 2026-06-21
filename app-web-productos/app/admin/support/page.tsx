"use client";

import { LifeBuoy, MessageSquareWarning } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import PageLoading from "../../../components/page-loading";
import { useToast } from "../../../components/toast-provider";

type SupportRow = {
  id: string;
  full_name: string;
  email: string;
  subject?: string;
  message?: string;
  code?: string;
  complaint_type?: string;
  detail?: string;
  status: string;
  admin_response: string | null;
  created_at: string;
};

export default function AdminSupportPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"support" | "complaints">("support");
  const [support, setSupport] = useState<SupportRow[]>([]);
  const [complaints, setComplaints] = useState<SupportRow[]>([]);

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth/sign-in?next=/admin/support");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.session.user.id).maybeSingle();
      if (profile?.role !== "admin") {
        router.replace("/");
        return;
      }
      const [supportResponse, complaintResponse] = await Promise.all([
        supabase.from("support_requests").select("*").order("created_at", { ascending: false }),
        supabase.from("complaints").select("*").order("created_at", { ascending: false }),
      ]);
      setSupport((supportResponse.data ?? []) as SupportRow[]);
      setComplaints((complaintResponse.data ?? []) as SupportRow[]);
      setLoading(false);
    })();
  }, [router, supabase]);

  async function update(table: "support_requests" | "complaints", row: SupportRow, status: string, response: string) {
    const { error } = await supabase
      .from(table)
      .update({ status, admin_response: response, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    showToast({ type: error ? "error" : "success", message: error ? error.message : "Caso actualizado." });
    if (!error) {
      const setter = table === "support_requests" ? setSupport : setComplaints;
      setter((current) => current.map((item) => item.id === row.id ? { ...item, status, admin_response: response } : item));
    }
  }

  if (loading) return <PageLoading label="Cargando soporte administrativo" />;
  const rows = tab === "support" ? support : complaints;

  return (
    <main className="app-page">
      <div className="mx-auto max-w-6xl">
        <h1 className="page-title text-3xl">Soporte administrativo</h1>
        <p className="mt-2 text-muted">Seguimiento de solicitudes y registros demostrativos.</p>
        <div className="mt-6 flex gap-2">
          <button onClick={() => setTab("support")} className={tab === "support" ? "btn-primary" : "btn-soft"}>
            <LifeBuoy size={18} /> Soporte ({support.length})
          </button>
          <button onClick={() => setTab("complaints")} className={tab === "complaints" ? "btn-primary" : "btn-soft"}>
            <MessageSquareWarning size={18} /> Reclamos ({complaints.length})
          </button>
        </div>
        <div className="mt-6 space-y-4">
          {rows.length === 0 ? <div className="info-box">No hay casos registrados.</div> : rows.map((row) => (
            <AdminCase key={row.id} row={row} onSave={(status, response) =>
              update(tab === "support" ? "support_requests" : "complaints", row, status, response)
            } />
          ))}
        </div>
      </div>
    </main>
  );
}

function AdminCase({ row, onSave }: { row: SupportRow; onSave: (status: string, response: string) => void }) {
  const [status, setStatus] = useState(row.status);
  const [response, setResponse] = useState(row.admin_response ?? "");
  return (
    <article className="app-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--primary)]">{row.code || row.subject || row.complaint_type}</p>
          <h2 className="mt-1 font-semibold">{row.full_name}</h2>
          <p className="text-sm text-muted">{row.email} · {new Date(row.created_at).toLocaleString("es-PE")}</p>
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="app-input sm:w-44">
          <option value="open">Abierto</option>
          <option value="in_progress">En proceso</option>
          <option value="resolved">Resuelto</option>
          <option value="closed">Cerrado</option>
        </select>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm">{row.message || row.detail}</p>
      <textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={3} className="app-input mt-4" placeholder="Respuesta o nota administrativa" />
      <button type="button" onClick={() => onSave(status, response)} className="btn-primary mt-3">Guardar seguimiento</button>
    </article>
  );
}
