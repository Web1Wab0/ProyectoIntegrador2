import { HeartHandshake, MapPinned, Store, Users } from "lucide-react";
import PublicPage from "../../components/public-page";

const values = [
  {
    icon: MapPinned,
    title: "Cercanía",
    text: "Ayudamos a descubrir productos y tiendas que forman parte del barrio.",
  },
  {
    icon: Store,
    title: "Comercio local",
    text: "Damos visibilidad digital a bodegas, librerías, bazares y emprendimientos.",
  },
  {
    icon: HeartHandshake,
    title: "Confianza",
    text: "Diseñamos reservas, reseñas verificadas y comunicación clara entre ambas partes.",
  },
];

export default function AboutPage() {
  return (
    <PublicPage
      title="Sobre AhorraPe"
      description="Una plataforma académica creada para acercar a las personas a los negocios locales y facilitar reservas para recojo."
    >
      <section>
        <p className="leading-7 text-muted">
          AhorraPe nació como parte del Proyecto Integrador 2 ante una idea
          sencilla: muchas tiendas cercanas tienen los productos que buscamos,
          pero no siempre es fácil conocer su precio, disponibilidad o
          ubicación. La plataforma reúne esa información y permite reservar
          antes de acercarse al local.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="section-title text-2xl">Nuestra misión</h2>
        <p className="mt-3 leading-7 text-muted">
          Conectar personas con negocios locales mediante una experiencia
          digital accesible, transparente y útil para clientes y vendedores.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {values.map((value) => {
          const Icon = value.icon;
          return (
            <article key={value.title} className="app-card-soft p-5">
              <Icon className="text-[var(--primary)]" />
              <h3 className="mt-4 font-semibold">{value.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{value.text}</p>
            </article>
          );
        })}
      </section>

      <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface-high)] p-5">
        <div className="flex items-start gap-3">
          <Users className="mt-1 shrink-0 text-[var(--secondary)]" />
          <div>
            <h2 className="section-title text-xl">El equipo</h2>
            <p className="mt-2 leading-7 text-muted">
              AhorraPe es desarrollado por el equipo académico del Proyecto
              Integrador 2. Esta versión es un prototipo funcional para fines
              educativos y de evaluación.
            </p>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
