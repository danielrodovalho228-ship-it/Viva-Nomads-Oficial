/*
  E84 — as páginas da ajuda: o hub (/ajuda) e a página própria do atendimento (/ajuda/fale-com-a-viva). Puro e leve
  (o chat e o botão flutuante importam daqui).
*/
/**
 * Parâmetros que pertencem ao atendimento (abrir chamado, acompanhar, avaliar, falar com uma pessoa). Os links antigos
 * (/ajuda?novo=1, ?chamado=…, e-mails já enviados) seguem valendo: o hub os passa para /ajuda/fale-com-a-viva.
 */
export const PARAMS_DO_ATENDIMENTO = ["novo", "chamado", "contexto", "servico", "pessoa", "avaliado", "avaliacao", "imovel"] as const;

export const HREF_FALE_COM_A_VIVA = "/ajuda/fale-com-a-viva";

/** Destino do hub com parâmetros de atendimento (ou null quando o hub deve abrir normalmente). */
export function destinoDoAtendimento(params: Record<string, string | string[] | undefined>): string | null {
  if (!PARAMS_DO_ATENDIMENTO.some((k) => params[k] !== undefined)) return null;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || k === "tema") continue;
    for (const item of Array.isArray(v) ? v : [v]) qs.append(k, item);
  }
  return `${HREF_FALE_COM_A_VIVA}?${qs.toString()}`;
}
