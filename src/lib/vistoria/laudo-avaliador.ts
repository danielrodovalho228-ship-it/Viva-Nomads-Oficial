/*
  E1079 (ORDEM-DUET-385/397), fatia 5 — o laudo do avaliador, como no mockup aprovado (avaliador-laudo): os textos da
  tela e o resumo (fotos enviadas, checklist). PURO (testado em e1079-laudo-avaliador.test.ts).
  Quem define o nível é o AVALIADOR, no laudo que assina (E1083, lib/vistoria/nivel-do-laudo.ts); aqui não há cálculo.
*/
import type { Nivel } from "../../config/niveis.ts";

export const TITULO_LAUDO = "Laudo da avaliação";
export const SUBTITULO_LAUDO = "Escolha o nível do imóvel";
export const ROTULO_ASSINAR_LAUDO = "Assinar laudo";
/** E1158 (4): a declaração que o avaliador marca ao assinar — a mesma na emissão e na reverificação. O termo do documento do laudo (escolha.ts) é outro texto e fica fora (ORDEM-DUET-673). */
export const DECLARACAO_DE_ASSINATURA_DO_LAUDO = "Assino este laudo como avaliador e respondo pelo que consta nele. A Viva forneceu o modelo e guarda o registro (número e hash); o conteúdo é meu.";

/** A frase de cada nível no cartão de escolha (as do desenho). */
export const DESCRICAO_NIVEL_LAUDO: Record<Nivel, string> = {
  essencial: "Simples e funcional",
  conforto: "Bem equipado e acolhedor",
  premium: "Acabamento superior",
};

export interface LinhaResumoLaudo {
  /** Verde quando está cumprido; cinza quando falta. */
  ok: boolean;
  texto: string;
}

/** "12 fotos enviadas" — as fotos da visita que o sistema tem. */
export function linhaFotos(n: number): LinhaResumoLaudo {
  if (n <= 0) return { ok: false, texto: "Nenhuma foto enviada" };
  return { ok: true, texto: `${n} ${n === 1 ? "foto enviada" : "fotos enviadas"}` };
}

/** "Checklist completo" só quando não falta resposta; senão, diz quantos itens faltam. */
export function linhaChecklist(faltam: number): LinhaResumoLaudo {
  if (faltam <= 0) return { ok: true, texto: "Checklist completo" };
  return { ok: false, texto: `Checklist incompleto: ${faltam === 1 ? "falta 1 item" : `faltam ${faltam} itens`}` };
}
