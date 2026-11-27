/*
  Prompt 61-A, item 1 (adendo Airbnb ao Prompt 32, item 6) — tela "Estadia confirmada". Regras puras, sem banco.
  Aparece uma vez, logo depois da segunda assinatura: quem assina por último é levado direto a ela; quem assinou
  antes recebe o aviso "contrato assinado" com o link para ela. Depois, fica acessível pela página da estadia.
  Texto direto: sem exclamação, sem festa. O próximo passo é concreto: a Caução e a conferência de entrada, cada uma
  com o prazo. Os prazos saem das fontes de sempre: a Caução vence na entrada (regra publicada "50% antes da entrada")
  e a conferência de entrada é prazoConferenciaEntrada (a mesma da linha do tempo e do servidor).
*/
import { textoPrazoConferencia } from "../conferencia.ts";
import { ddmmaaaa, prazoDaConferencia, type PeriodoEstadia } from "./estadia.ts";

export const HREF_CONFIRMADA = (contratoId: string): string => `/dashboard/estadia/${contratoId}/confirmada`;

export const TITULO_CONFIRMADA = "Estadia confirmada";
export const TEXTO_CONFIRMADA = "Contrato assinado pelos dois lados.";

export interface PassoConfirmacao {
  chave: "caucao" | "conferencia";
  rotulo: string;
  prazo: string;
}

/**
 * O próximo passo, item a item, com o prazo de cada um. Caução recebida ou dispensada (seguro-fiança) não aparece;
 * sem data de entrada, o prazo fica "a definir" (nunca inventado).
 */
export function proximosPassos(p: PeriodoEstadia, caucao: "pendente" | "recebida" | "dispensada"): PassoConfirmacao[] {
  const passos: PassoConfirmacao[] = [];
  if (caucao === "pendente") passos.push({ chave: "caucao", rotulo: "Caução", prazo: p.inicio ? `até a entrada, em ${ddmmaaaa(p.inicio)}` : "até a entrada, data a definir" });
  // E1238: o mesmo prazo da lista "antes da entrada" (o pronto do servidor, ou a regra sem hora).
  const prazo = p.inicio ? prazoDaConferencia(p) : null;
  passos.push({ chave: "conferencia", rotulo: "Conferência de entrada", prazo: prazo ? textoPrazoConferencia(prazo) : "a definir, com a data de entrada" });
  return passos;
}
