export default function PageLoading({
  label = "Cargando contenido",
}: {
  label?: string;
}) {
  return (
    <main className="app-page" aria-busy="true" aria-label={label}>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="skeleton h-9 w-64 max-w-full rounded-lg" />
        <div className="skeleton h-5 w-96 max-w-full rounded-lg" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="skeleton h-52 rounded-xl" />
          <div className="skeleton h-52 rounded-xl" />
        </div>
      </div>
    </main>
  );
}
