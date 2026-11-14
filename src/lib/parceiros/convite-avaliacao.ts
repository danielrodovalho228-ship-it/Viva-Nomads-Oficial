/*
  Prompt 62-A, Parte 1, item 1 — o convite em "Seja parceiro": avaliação de imóveis é credenciamento à parte (identidade,
  experiência, código de conduta, relações e avaliação de teste), nunca categoria do catálogo. PURO.
*/
import { ROTA_RECRUTAMENTO } from "../vistoria/entrada.ts";

/** E902: "Ver os passos do credenciamento" leva à página pública de recrutamento (/parceiros/avaliadores), não ao painel logado. */
export const HREF_PASSOS_CREDENCIAMENTO = ROTA_RECRUTAMENTO;

export const CONVITE_SEJA_PARCEIRO = {
  titulo: "Avaliação de imóveis",
  texto: "Credenciamento à parte: identidade, experiência, código de conduta, declaração de relações e uma avaliação de teste. O proprietário escolhe o avaliador, e você define o seu valor e o seu prazo.",
  link: "Ver os passos do credenciamento",
};
