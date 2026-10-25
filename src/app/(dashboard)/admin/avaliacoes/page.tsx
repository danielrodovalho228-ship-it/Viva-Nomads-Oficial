import { redirect } from "next/navigation";
import { hrefCentral } from "@/lib/admin/central-pendencias";

/** ADMIN-2: os pedidos de revisão de avaliação viraram o filtro "Avaliações contestadas" da Central (links antigos seguem). */
export default function AdminAvaliacoesPage() {
  redirect(hrefCentral("avaliacoes_contestadas"));
}
