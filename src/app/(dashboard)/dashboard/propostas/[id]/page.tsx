import { notFound } from "next/navigation";
import { lerProposta } from "@/lib/data/propostas-actions";
import { PropostaDetalhe } from "./proposta-detalhe";
import { FalarComAViva } from "@/components/ajuda/falar-com-a-viva";
import { RespostaRapida } from "@/components/ajuda/resposta-rapida";
import { BadgeCheck } from "lucide-react";
import { seloDoCandidato } from "@/lib/triagem/servidor";

/**
 * Proposta (prompt 17): a mesma tela para o proprietário e para o interessado. Quem não é parte recebe 404
 * (a leitura passa pela RLS). Abrir uma proposta "Enviada" como interessado a marca como "Vista".
 */
export default async function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await lerProposta(id);
  if (!p) notFound();
  // Prompt 52 (chave TRIAGEM_VINCULO_ATIVA): só o dono vê o selo do interessado — nunca arquivo nem valores.
  const selo = p.papel === "owner" && p.leadId ? await seloDoCandidato(p.leadId) : null;
  return (
    <>
      {selo && (
        <p className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-forest" data-testid="selo-morador-verificado">
          <BadgeCheck className="h-4 w-4" aria-hidden /> {selo}
        </p>
      )}
      <PropostaDetalhe p={p} />
      <RespostaRapida faqId="prazo" />
      <FalarComAViva />
    </>
  );
}
