/*
  PRAZOS PÚBLICOS DE RESPOSTA — FONTE ÚNICA, um prazo por canal (Família 1: E835, E770, E854, E860, E861, E876, E878).
  Toda superfície pública que promete um prazo de resposta da Viva lê daqui; nada de número escrito à mão na página.
  O prazo canônico de cada canal é o que a superfície principal dele já prometia em 14/11/2026:
    • parceiro (pedido de parceria) ...... /parceiros: até 7 dias (E791)
    • empresas (Fale com a gente) ........ /empresas: até 7 dias (E770)
    • suporte (chamado / Fale com a Viva) . /ajuda: uma pessoa em até 24 h (config/atendimento.ts, PROMESSA_HUMANA_H)
  PURO: testável com node --test (imports relativos).
*/
import { PROMESSA_HUMANA_H } from "./atendimento.ts";

export const PRAZO_CANAL = {
  parceiro: { dias: 7, texto: "7 dias" },
  empresas: { dias: 7, texto: "7 dias" },
  suporte: { horas: PROMESSA_HUMANA_H, texto: `${PROMESSA_HUMANA_H} h` },
} as const;

/** Canal parceiro: a resposta ao pedido de parceria (/parceiros, o cadastro, a Ajuda). */
export const TEXTO_PRAZO_PARCERIA = `A Viva responde por e-mail em até ${PRAZO_CANAL.parceiro.texto}.`;

/** Canal empresas: o retorno ao "Fale com a gente" de /empresas. */
export const TEXTO_PRAZO_EMPRESAS = `A equipe responde em até ${PRAZO_CANAL.empresas.texto}, no e-mail informado, com as opções de imóveis.`;
