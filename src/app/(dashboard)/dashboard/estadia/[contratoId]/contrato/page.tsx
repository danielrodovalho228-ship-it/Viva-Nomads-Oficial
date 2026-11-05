import { ContratoDetalhe } from "@/components/contrato/contrato-detalhe";
import { FalarComAViva } from "@/components/ajuda/falar-com-a-viva";
import { ValorDiretoAoProprietario } from "@/components/contexto/cabecalho-contexto";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";

export const metadata = { title: "Contrato", robots: { index: false, follow: false } };

/** E539 (i): o contrato do morador, dentro da URL da estadia (antes em /dashboard/locacoes/<id>). */
export default async function ContratoDaEstadiaPage({ params }: { params: Promise<{ contratoId: string }> }) {
  const { contratoId } = await params;
  return (
    <>
      <ContratoDetalhe id={contratoId} voltarHref={HREF_ESTADIA(contratoId)} voltarRotulo="Estadia" />
      <ValorDiretoAoProprietario className="mt-4 text-sm text-muted" />
      <FalarComAViva />
    </>
  );
}
