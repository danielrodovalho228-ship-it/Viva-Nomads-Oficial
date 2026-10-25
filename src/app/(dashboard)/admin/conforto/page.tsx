import { redirect } from "next/navigation";
import { hrefCentral } from "@/lib/admin/central-pendencias";

/** Adendo 59.1: a fila do 59-A virou filtro da Central de Pendências (links antigos continuam funcionando). */
export default function AdminConfortoPage() {
  redirect(hrefCentral("conforto_contestacoes"));
}
