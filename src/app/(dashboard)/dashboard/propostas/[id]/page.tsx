import { notFound } from "next/navigation";
import { lerProposta } from "@/lib/data/propostas-actions";
import { PropostaDetalhe } from "./proposta-detalhe";
import { FalarComAViva } from "@/components/ajuda/falar-com-a-viva";
import { RespostaRapida } from "@/components/ajuda/resposta-rapida";

/**
 * Proposta (prompt 17): a mesma tela para o proprietário e para o interessado. Quem não é parte recebe 404
 * (a leitura passa pela RLS). Abrir uma proposta "Enviada" como interessado a marca como "Vista".
 */
export default async function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await lerProposta(id);
  if (!p) notFound();
  return (
    <>
      <PropostaDetalhe p={p} />
      <RespostaRapida faqId="prazo" />
      <FalarComAViva />
    </>
  );
}
