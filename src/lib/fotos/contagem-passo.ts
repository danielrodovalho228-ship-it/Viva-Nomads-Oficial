/*
  E417 (D8) — o cartão de contagem do passo de fotos mostrava "8 / 8 fotos" e, logo abaixo, "Faltam 8 fotos para
  continuar". Eram duas contas: o número soma as fotos já enviadas do lote em andamento (E259), e a trava vinha da
  página, que só vê as fotos depois que o lote inteiro termina (incluindo a conferência "é do imóvel?"). Agora o aviso
  do cartão sai da MESMA conta do número; com o mínimo já enviado e o lote ainda terminando, diz isso em vez de
  "faltam". A trava do "Continuar" segue nas fotos que já entraram na galeria. PURO.
  Roda: node --test src/lib/fotos/contagem-passo.test.ts
*/
import type { EstadoPassoFotos } from "./conteudo.ts";

export const TEXTO_TERMINANDO_ENVIO = "Terminando o envio: as fotos entram na galeria em instantes.";

export interface AvisoContagem {
  /** O mesmo código da trava da página; "enviando" quando o mínimo já foi enviado e o lote ainda não terminou. */
  trava: EstadoPassoFotos["trava"] | "enviando" | null;
  mensagem: string | null;
}

/** O aviso do cartão de contagem, coerente com o número mostrado (`contadas` = galeria + enviadas do lote atual). */
export function avisoDaContagem(passo: EstadoPassoFotos | undefined, contadas: number, minimo: number): AvisoContagem {
  if (!passo || passo.podeContinuar) return { trava: null, mensagem: null };
  if (passo.trava !== "faltam") return { trava: passo.trava, mensagem: passo.mensagem };
  const faltam = Math.max(0, minimo - contadas);
  if (faltam === 0) return { trava: "enviando", mensagem: TEXTO_TERMINANDO_ENVIO };
  return { trava: "faltam", mensagem: `${faltam === 1 ? "Falta 1 foto" : `Faltam ${faltam} fotos`} para continuar (mínimo de ${minimo}).` };
}
