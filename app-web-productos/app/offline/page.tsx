import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="app-page flex items-center justify-center">
      <div className="app-card max-w-md p-8 text-center">
        <WifiOff size={34} className="mx-auto text-[var(--primary)]" />
        <h1 className="page-title mt-4 text-2xl">Sin conexión</h1>
        <p className="mt-2 text-muted">
          Revisa tu conexión a internet y vuelve a intentarlo.
        </p>
        <Link href="/" className="btn-primary mt-6">
          Reintentar
        </Link>
      </div>
    </main>
  );
}
