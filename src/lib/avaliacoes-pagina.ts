/*
  E679 — PR 2: a página de avaliar (mockups avaliacoes-avaliar-morador/-proprietario, desktop e celular). Os textos de
  cada par e o período da estadia, puros. Os critérios e as etiquetas moram em avaliacoes-criterios.ts (Pista B).
*/
import type { ParAvaliacao } from "./avaliacoes-criterios.ts";
import { dataLonga } from "./conta/painel-avaliacoes.ts";

export const hrefPaginaAvaliar = (contratoId: string) => `/dashboard/avaliacoes/avaliar/${contratoId}`;

interface TextosAvaliar {
  pagina: string;
  geral: string;
  etiquetas: string;
  texto: string;
  placeholder: string;
  recomenda: string;
}

/** Os textos do mockup, por par. Sem gênero presumido na pergunta final ("esta pessoa"). */
export const TEXTOS_AVALIAR: Record<"morador_avalia_dono" | "dono_avalia_morador", TextosAvaliar> = {
  morador_avalia_dono: {
    pagina: "Avalie sua estadia",
    geral: "Como foi, no geral?",
    etiquetas: "Tags rápidas",
    texto: "Conte para futuros moradores",
    placeholder: "O que você gostou? Pontos de destaque, dica para futuros moradores...",
    recomenda: "Você recomendaria esta estadia?",
  },
  dono_avalia_morador: {
    pagina: "Avalie o morador",
    geral: "Como foi, no geral?",
    etiquetas: "Destaques da estadia",
    texto: "Conte para futuros proprietários",
    placeholder: "Escreva sua avaliação... Como foi o cuidado, a comunicação, o cumprimento das regras?",
    recomenda: "Você receberia esta pessoa de novo?",
  },
};

export type ParDaEstadia = keyof typeof TEXTOS_AVALIAR;
export const ehParDaEstadia = (p: ParAvaliacao): p is ParDaEstadia => p === "morador_avalia_dono" || p === "dono_avalia_morador";

/** "Estadia de 12 de agosto a 10 de novembro"; sem as duas datas, nada. */
export function periodoPorExtenso(inicio: string | null | undefined, fim: string | null | undefined): string {
  const a = dataLonga(inicio ? `${inicio.slice(0, 10)}T12:00:00Z` : null);
  const b = dataLonga(fim ? `${fim.slice(0, 10)}T12:00:00Z` : null);
  return a && b ? `Estadia de ${a} a ${b}` : "";
}
