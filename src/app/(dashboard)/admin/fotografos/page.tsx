import { redirect } from "next/navigation";
import { HREF_FOTOGRAFOS } from "@/lib/admin/parceiros-tipo";

/** ADMIN-2: os Fotógrafos viraram a aba de tipo de Parceiros (links antigos continuam funcionando). */
export default function AdminFotografosPage() {
  redirect(HREF_FOTOGRAFOS);
}
