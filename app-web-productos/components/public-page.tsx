import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PublicPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="app-page">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="btn-soft mb-6">
          <ArrowLeft size={17} />
          Volver al inicio
        </Link>
        <header className="mb-8">
          <h1 className="page-title text-3xl sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
            {description}
          </p>
        </header>
        <div className="app-card p-5 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
