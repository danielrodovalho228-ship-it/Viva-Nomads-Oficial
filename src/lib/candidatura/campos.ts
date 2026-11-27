/**
 * E581: os campos de período da candidatura, com a mesma validação no insert e na atualização da candidatura repetida.
 * A saída só entra com a entrada válida e depois dela (o check da 0258); sem saída válida, fica null.
 */
export function camposDaCandidatura(e: {
  inicioOk: boolean;
  inicio: string;
  fim: string;
  motivo: string | null;
  ocupantes: number | null;
}): { inicio_desejado: string | null; fim_desejado: string | null; motivo_estadia: string | null; qtd_ocupantes: number | null } {
  const inicio = e.inicioOk ? e.inicio.trim() : null;
  const fim = (e.fim ?? "").trim();
  const fimOk = !!inicio && /^\d{4}-\d{2}-\d{2}$/.test(fim) && fim > inicio;
  return { inicio_desejado: inicio, fim_desejado: fimOk ? fim : null, motivo_estadia: e.motivo, qtd_ocupantes: e.ocupantes };
}

export const MSG_CANDIDATURA_JA_RESPONDIDA =
  "O proprietário já respondeu à sua candidatura para este imóvel. Para mudar o período, fale com ele pelo chat.";
export const MSG_CANDIDATURA_NAO_ATUALIZOU = "Não foi possível atualizar a sua candidatura agora. Tente de novo em instantes.";
