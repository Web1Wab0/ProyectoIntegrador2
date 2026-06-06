import Link from "next/link";

export default function AppHeader() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(44,47,48,0.06)] bg-[rgba(255,255,255,0.7)] backdrop-blur-[20px]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 hover:bg-[rgba(121,0,243,0.06)] sm:gap-3 sm:px-2"
        >
          <div className="hero-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-base font-bold sm:h-10 sm:w-10 sm:text-lg">
            A
          </div>

          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[var(--on-surface)] sm:text-lg">
              AhorraPe
            </p>
            <p className="hidden text-xs text-[var(--muted)] sm:block">
              Busca, compra y reserva
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
