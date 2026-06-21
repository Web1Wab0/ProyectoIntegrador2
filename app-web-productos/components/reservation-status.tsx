import {
  CheckCircle2,
  CircleEllipsis,
  PackageCheck,
  PackageOpen,
  XCircle,
} from "lucide-react";

const statuses = {
  pending: {
    label: "Pendiente",
    className: "bg-amber-50 text-amber-700",
    icon: CircleEllipsis,
  },
  confirmed: {
    label: "Confirmada",
    className: "bg-cyan-50 text-cyan-700",
    icon: CheckCircle2,
  },
  ready: {
    label: "Lista para recoger",
    className: "bg-violet-50 text-violet-700",
    icon: PackageOpen,
  },
  completed: {
    label: "Completada",
    className: "bg-emerald-50 text-emerald-700",
    icon: PackageCheck,
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-red-50 text-red-700",
    icon: XCircle,
  },
} as const;

export function getReservationStatusLabel(status: string) {
  return statuses[status as keyof typeof statuses]?.label ?? status;
}

export default function ReservationStatus({ status }: { status: string }) {
  const config = statuses[status as keyof typeof statuses] ?? {
    label: status,
    className: "bg-slate-100 text-slate-700",
    icon: CircleEllipsis,
  };
  const Icon = config.icon;

  return (
    <span className={`status-badge gap-1.5 ${config.className}`}>
      <Icon size={14} aria-hidden="true" />
      {config.label}
    </span>
  );
}
