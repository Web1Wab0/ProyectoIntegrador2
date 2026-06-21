import PublicPage from "../../components/public-page";

export default function TermsPage() {
  return (
    <PublicPage
      title="Términos de servicio"
      description="Condiciones de uso del prototipo académico AhorraPe."
    >
      <div className="space-y-7 leading-7 text-muted">
        <section>
          <h2 className="section-title text-xl">Naturaleza del servicio</h2>
          <p className="mt-2">
            AhorraPe ayuda a encontrar tiendas y reservar productos para
            recojo. No procesa pagos, no realiza delivery y no vende
            directamente los productos publicados por los negocios.
          </p>
        </section>
        <section>
          <h2 className="section-title text-xl">Responsabilidad del usuario</h2>
          <p className="mt-2">
            Los clientes deben proporcionar datos correctos, respetar los
            horarios y utilizar las reservas de buena fe. Los vendedores deben
            mantener precios, stock, ubicación y horarios actualizados.
          </p>
        </section>
        <section>
          <h2 className="section-title text-xl">Productos restringidos</h2>
          <p className="mt-2">
            Los productos marcados como 18+ requieren una declaración de
            mayoría de edad. El comercio debe verificar la edad durante el
            recojo cuando corresponda.
          </p>
        </section>
        <section>
          <h2 className="section-title text-xl">Disponibilidad</h2>
          <p className="mt-2">
            Una reserva depende de la confirmación y disponibilidad del
            vendedor. La plataforma puede modificar o suspender funciones por
            mantenimiento, seguridad o evolución del proyecto.
          </p>
        </section>
        <section>
          <h2 className="section-title text-xl">Proyecto académico</h2>
          <p className="mt-2">
            Esta versión se presenta con fines educativos. Los términos y
            páginas legales deberán ser revisados por un profesional antes de
            utilizar AhorraPe como servicio comercial formal.
          </p>
        </section>
      </div>
    </PublicPage>
  );
}
