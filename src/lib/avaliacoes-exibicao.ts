/*
  Prompt 61-A, item 3 (adendo Airbnb ao Prompt 45, item 9) — "Como funcionam as avaliações" e a linha de quem avaliou.
  PURO. As regras são as do servidor (0089): só quem morou avalia; às cegas; publica quando as duas partes avaliam ou
  quando vence o prazo (DIAS_PRAZO_AVALIACAO depois do fim). Nada de nome: a linha mostra a cidade e o ano de entrada.
*/
import { DIAS_PRAZO_AVALIACAO } from "./avaliacoes.ts";

export const TITULO_COMO_FUNCIONAM = "Como funcionam as avaliações";

export const REGRAS_AVALIACOES: readonly string[] = [
  "Só avalia quem morou no imóvel, com contrato assinado pela Viva.",
  "Morador e proprietário avaliam sem ver a avaliação um do outro.",
  `A avaliação é publicada depois que os dois avaliam, ou ${DIAS_PRAZO_AVALIACAO} dias depois do fim da estadia.`,
  "O proprietário pode responder em público, embaixo da avaliação.",
];

/** "Uberlândia · na Viva desde 2025" — só o que existe; sem nada, null. */
export function linhaAutorAvaliacao(a: { cidade?: string | null; desde?: string | null }): string | null {
  const cidade = (a.cidade ?? "").trim();
  const t = a.desde ? Date.parse(a.desde) : NaN;
  const ano = Number.isFinite(t) ? new Date(t).getUTCFullYear() : null;
  const partes = [cidade, ano ? `na Viva desde ${ano}` : ""].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}
