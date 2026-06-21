import ContactForm from "../../components/contact-form";
import PublicPage from "../../components/public-page";

export default function ContactPage() {
  return (
    <PublicPage
      title="Contacto y soporte"
      description="Cuéntanos tu consulta o problema. Las solicitudes quedan registradas para que el equipo pueda darles seguimiento."
    >
      <ContactForm />
    </PublicPage>
  );
}
