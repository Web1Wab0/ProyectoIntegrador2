import FaqList from "../../components/faq-list";
import PublicPage from "../../components/public-page";

export default function FaqPage() {
  return (
    <PublicPage
      title="Preguntas frecuentes"
      description="Respuestas rápidas para clientes y vendedores que utilizan AhorraPe."
    >
      <FaqList />
    </PublicPage>
  );
}
