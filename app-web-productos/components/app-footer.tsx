import Link from "next/link";
import { BookOpenCheck, Mail, Store } from "lucide-react";

export default function AppFooter() {
  const supportEmail =
    process.env.SUPPORT_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface-lowest)]">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-10">
        <div>
          <div className="flex items-center gap-3">
            <div className="hero-gradient flex h-10 w-10 items-center justify-center rounded-lg text-white">
              <Store size={20} />
            </div>
            <div>
              <p className="font-bold">AhorraPe</p>
              <p className="text-sm text-muted">
                Conectando personas con negocios locales.
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            Proyecto académico del Proyecto Integrador 2. AhorraPe facilita
            reservas para recojo y no procesa pagos dentro de la plataforma.
          </p>
        </div>

        <nav aria-label="Información" className="grid content-start gap-2 text-sm">
          <p className="mb-1 font-semibold">Información</p>
          <Link href="/about" className="link-primary w-fit">Sobre nosotros</Link>
          <Link href="/faq" className="link-primary w-fit">Preguntas frecuentes</Link>
          <Link href="/privacy" className="link-primary w-fit">Privacidad</Link>
          <Link href="/terms" className="link-primary w-fit">Términos de servicio</Link>
        </nav>

        <div className="grid content-start gap-3 text-sm">
          <p className="font-semibold">Ayuda y reclamos</p>
          <Link href="/contact" className="inline-flex w-fit items-center gap-2 text-[var(--primary)]">
            <Mail size={16} />
            Contacto y soporte
          </Link>
          <Link href="/complaints" className="inline-flex w-fit items-center gap-2 rounded-lg border border-[var(--primary)] px-3 py-2 font-semibold text-[var(--primary)]">
            <BookOpenCheck size={17} />
            Libro de Reclamaciones
          </Link>
          {supportEmail ? (
            <a href={`mailto:${supportEmail}`} className="break-all text-muted hover:text-[var(--primary)]">
              {supportEmail}
            </a>
          ) : (
            <p className="text-xs text-muted">
              El correo de soporte se publicará al configurar SUPPORT_EMAIL.
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-[var(--border)] px-4 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} AhorraPe · Proyecto académico
      </div>
    </footer>
  );
}
