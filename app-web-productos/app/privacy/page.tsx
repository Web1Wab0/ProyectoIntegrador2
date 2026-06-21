import PublicPage from "../../components/public-page";

export default function PrivacyPage() {
  return (
    <PublicPage
      title="Política de privacidad"
      description="Información sobre los datos utilizados por el prototipo académico AhorraPe."
    >
      <div className="space-y-7 leading-7 text-muted">
        <section>
          <h2 className="section-title text-xl">Datos que recopilamos</h2>
          <p className="mt-2">
            Cuenta, nombre, apellidos, correo, teléfono, rol, tiendas,
            productos, reservas, reseñas, favoritos, solicitudes de soporte y
            reclamos enviados voluntariamente.
          </p>
        </section>
        <section>
          <h2 className="section-title text-xl">Ubicación</h2>
          <p className="mt-2">
            La ubicación del cliente se solicita desde el navegador para
            calcular distancias. No se guarda como historial personal. La
            ubicación de la tienda sí se almacena porque forma parte de su
            información pública.
          </p>
        </section>
        <section>
          <h2 className="section-title text-xl">Analítica</h2>
          <p className="mt-2">
            Las visitas se registran con un identificador pseudónimo de sesión,
            sin guardar IP ni coordenadas exactas. El usuario puede desactivar
            esta medición desde su perfil.
          </p>
        </section>
        <section>
          <h2 className="section-title text-xl">Notificaciones</h2>
          <p className="mt-2">
            Las notificaciones internas se vinculan con la cuenta. Las
            notificaciones push requieren consentimiento explícito y pueden
            desactivarse en cualquier momento.
          </p>
        </section>
        <section>
          <h2 className="section-title text-xl">Seguridad y conservación</h2>
          <p className="mt-2">
            Supabase protege los datos mediante autenticación y seguridad a
            nivel de fila. Este documento es informativo para un proyecto
            académico y deberá revisarse profesionalmente antes de operar como
            empresa formal.
          </p>
        </section>
      </div>
    </PublicPage>
  );
}
