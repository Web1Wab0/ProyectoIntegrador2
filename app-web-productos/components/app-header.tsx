import Link from "next/link";

export default function AppHeader() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-[rgba(44,47,48,0.06)] bg-[rgba(255,255,255,0.7)] backdrop-blur-[20px]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-[rgba(121,0,243,0.06)]"
        >
          <div className="hero-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-lg font-bold">
            A
          </div>

          <div>
            <p className="text-lg font-bold text-[var(--on-surface)]">
              AhorraPe
            </p>
            <p className="text-xs text-[var(--muted)]">
              Busca, compra y reserva
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}