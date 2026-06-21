import ComplaintForm from "../../components/complaint-form";
import PublicPage from "../../components/public-page";

export default function ComplaintsPage() {
  return (
    <PublicPage
      title="Libro de Reclamaciones"
      description="Registra una queja o reclamo y obtén una constancia con código de seguimiento."
    >
      <ComplaintForm />
    </PublicPage>
  );
}
