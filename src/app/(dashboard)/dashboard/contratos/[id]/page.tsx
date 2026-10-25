import { ContratoDetalhe } from "@/components/contrato/contrato-detalhe";
import { FalarComAViva } from "@/components/ajuda/falar-com-a-viva";
import { ValorDiretoAoProprietario } from "@/components/contexto/cabecalho-contexto";

export const metadata = { title: "Contrato" };

export default async function ContratoDonoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <ContratoDetalhe id={id} voltarHref="/dashboard/contratos" voltarRotulo="Contratos" />
      <ValorDiretoAoProprietario className="mt-4 text-sm text-muted" />
      <FalarComAViva />
    </>
  );
}
