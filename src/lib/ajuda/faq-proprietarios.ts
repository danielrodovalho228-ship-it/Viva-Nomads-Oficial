/*
  E847 — "Perguntas frequentes" de /para-proprietarios: só perguntas da FONTE ÚNICA (lib/atendimento/faq.ts, as mesmas da
  Central de Ajuda), na resposta que o visitante vê. Nenhuma resposta nova aqui. PURO.
*/
import { FAQ, respostaPara, type Pergunta } from "../atendimento/faq.ts";

/** Quem anuncia o imóvel: custo, publicação, fotos, limpeza, caução, renovação e manutenção (sem parceiro/avaliador). */
export const PERGUNTAS_PARA_PROPRIETARIOS: readonly string[] = [
  "custo-anunciar",
  "anuncio-nao-publica",
  "contratar-fotografo",
  "limpeza-estadia",
  "caucao",
  "renovar",
  "manutencao",
];

export function perguntasParaProprietarios(): Pergunta[] {
  return PERGUNTAS_PARA_PROPRIETARIOS.map((id) => FAQ.find((p) => p.id === id))
    .filter((p): p is Pergunta => !!p)
    .map((p) => ({ ...p, resposta: respostaPara(p, "visitante") }));
}
