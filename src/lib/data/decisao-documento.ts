/*
  Campos gravados quando o admin decide um documento (#40): quem decidiu SEMPRE vai junto
  com a data — nunca uma decisão sem revisor. Puro, para testar com node --test.
*/
export interface DecisaoDocumento {
  document_status: "approved" | "rejected";
  document_review_reason: string | null;
  document_reviewed_at: string;
  document_reviewed_by: string;
}

export function montarDecisaoDocumento(aprovado: boolean, motivo: string, revisorId: string, agora: Date): DecisaoDocumento {
  if (!revisorId) throw new Error("Decisão de documento exige o id do revisor.");
  return {
    document_status: aprovado ? "approved" : "rejected",
    document_review_reason: aprovado ? null : motivo,
    document_reviewed_at: agora.toISOString(),
    document_reviewed_by: revisorId,
  };
}
