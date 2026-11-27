import { permanentRedirect } from "next/navigation";
import { HREF_CONTRATO_DA_ESTADIA } from "@/lib/estadia/estadia";

export const metadata = { title: "Contrato" };

/**
 * E539 (i): a estadia do morador tem uma URL só (/dashboard/estadia/<id>); o contrato fica logo abaixo dela. Este
 * endereço antigo (e-mails, avisos e favoritos já enviados) só redireciona; o #trecho do link vai junto no navegador.
 */
export default async function LocacaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  permanentRedirect(HREF_CONTRATO_DA_ESTADIA(id));
}
