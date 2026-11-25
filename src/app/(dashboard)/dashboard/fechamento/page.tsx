import type { Metadata } from "next";
import { getFechamentoContext } from "@/lib/data/leads-actions";
import { lerFechosDoDono } from "@/lib/data/fechos-do-dono-servidor";
import { ClosingClient, type FechosDaPagina } from "./closing-client";
import { FalarComAViva } from "@/components/ajuda/falar-com-a-viva";
import { RespostaRapida } from "@/components/ajuda/resposta-rapida";

export const metadata: Metadata = {
  title: "Fechamento",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Rota do fechamento — SEMPRE valida no servidor. O contexto vem de uma
 * candidatura ACEITA real (imóvel, partes, valores + comissão congelada no
 * aceite); `?c=<leadId>` escolhe uma candidatura específica. Sem candidatura
 * aceita, o contexto é null e o cliente mostra a guarda (o fechamento não
 * existe sem ela). O modo demonstração (admin) usa o exemplo no cliente.
 *
 * E1090: a página lê TODOS os fechos do dono (`lerFechosDoDono`). Sem `?c=`, abre a primeira linha da ordem (o que
 * espera o dono), não a aceita mais recente; com `?c=` do dono, abre-a como antes (R8); com `?c=` que não é dele, mostra
 * os fechos dele com "Não encontramos esse fechamento" (R9). A falha da leitura lança (R10).
 */
export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const lidos = await lerFechosDoDono();
  let realCtx = c ? await getFechamentoContext(c) : null;
  const naoEncontrado = Boolean(c) && !realCtx;
  if (!realCtx) {
    if (lidos) realCtx = lidos.abrir ? await getFechamentoContext(lidos.abrir) : null;
    else if (!c) realCtx = await getFechamentoContext();
  }
  const fechos: FechosDaPagina | null = lidos
    ? {
        linhas: lidos.linhas,
        foraDoTeto: lidos.foraDoTeto,
        atual: realCtx ? (lidos.linhas.find((l) => l.leadId === realCtx!.leadId && l.acao.tipo === "assistente")?.chave ?? null) : null,
        naoEncontrado,
        temAceitas: lidos.temAceitas,
      }
    : null;
  return (
    <>
      <ClosingClient realCtx={realCtx} fechos={fechos} />
      <RespostaRapida faqId="caucao" />
      <FalarComAViva />
    </>
  );
}
