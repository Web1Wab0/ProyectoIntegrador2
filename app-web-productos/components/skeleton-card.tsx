type SkeletonCardProps = {
  imageHeightClass?: string;
  compact?: boolean;
  className?: string;
};

export default function SkeletonCard({
  imageHeightClass = "h-56",
  compact = false,
  className = "",
}: SkeletonCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-lowest)] ${className}`}
      aria-hidden="true"
    >
      <div className={`skeleton ${imageHeightClass}`} />
      <div className={compact ? "space-y-2 p-3" : "space-y-3 p-4"}>
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        {!compact ? (
          <>
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function SkeletonGrid({
  count = 4,
  imageHeightClass = "h-56",
}: {
  count?: number;
  imageHeightClass?: string;
}) {
  return (
    <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} imageHeightClass={imageHeightClass} />
      ))}
    </div>
  );
}
