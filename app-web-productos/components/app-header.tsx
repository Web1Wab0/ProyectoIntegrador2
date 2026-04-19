import Link from "next/link";

export default function AppHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-gray-800"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-lg font-bold text-white">
            A
          </div>

          <div>
            <p className="text-lg font-bold text-white">AhorraPe</p>
            <p className="text-xs text-gray-400">
              Busca, compara y reserva
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}