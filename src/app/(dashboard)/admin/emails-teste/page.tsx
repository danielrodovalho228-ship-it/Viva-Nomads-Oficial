import { redirect } from "next/navigation";
import { HREF_EMAILS_TESTE } from "@/lib/admin/dados-teste-abas";

/** ADMIN-2: os E-mails de teste viraram a aba "E-mails" de Dados de teste (links antigos continuam funcionando). */
export default function AdminEmailsTestePage() {
  redirect(HREF_EMAILS_TESTE);
}
