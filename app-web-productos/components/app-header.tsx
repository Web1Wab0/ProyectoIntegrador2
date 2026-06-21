import Link from "next/link";
import { Store } from "lucide-react";
import AuthAccessMenu from "./auth-access-menu";
import NotificationCenter from "./notification-center";

export default function AppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-[10000] border-b border-[var(--border)] bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 rounded-lg py-1 outline-none transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:gap-3"
        >
          <div className="hero-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm sm:h-10 sm:w-10">
            <Store size={20} strokeWidth={2.3} />
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

        <div className="flex items-center gap-2">
          <NotificationCenter />
          <AuthAccessMenu />
        </div>
      </div>
    </header>
  );
}
