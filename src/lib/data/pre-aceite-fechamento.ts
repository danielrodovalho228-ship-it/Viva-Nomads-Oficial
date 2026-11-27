/*
  E968 — o Fechamento nunca usa o preço do anúncio quando a pré-aceitação da candidatura expirou. PURO (a leitura no banco
  fica em propostas-servidor.ts, `preAceiteExpiradoDoLead`).
  A pré-aceitação mais recente do lead (a proposta com aceita_em mais novo) decide:
   • "expirada" → a candidatura voltou ao dono (E4); o contrato só sai depois da reabertura, com os valores e a taxa
     congelados no pré-aceite (E722). Barra.
   • aceita / em_contrato / contrato_assinado, ou nenhuma proposta pré-aceita → segue como antes.
*/

export const MSG_PRE_ACEITE_EXPIRADO =
  "A pré-aceitação desta candidatura expirou e ela voltou para o proprietário decidir. Para gerar o contrato, reabra a proposta: os valores e a taxa congelados continuam valendo.";

export function decisaoDoPreAceite(maisRecente: { status: string; aceita_em: string | null } | null): "expirada" | "segue" {
  return maisRecente && maisRecente.aceita_em && maisRecente.status === "expirada" ? "expirada" : "segue";
}
