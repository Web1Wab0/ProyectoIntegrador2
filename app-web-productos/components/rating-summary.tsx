import { Star } from "lucide-react";

export default function RatingSummary({
  average,
  count,
  compact = false,
}: {
  average: number;
  count: number;
  compact?: boolean;
}) {
  if (!count) {
    return <span className="text-xs text-muted">Sin reseñas todavía</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${compact ? "text-xs" : "text-sm"}`}>
      <Star size={compact ? 14 : 16} className="fill-amber-400 text-amber-400" />
      <strong>{average.toFixed(1)}</strong>
      <span className="text-muted">({count})</span>
    </span>
  );
}
