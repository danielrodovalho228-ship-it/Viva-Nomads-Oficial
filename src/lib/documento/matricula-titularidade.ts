/*
  E633 — matrícula atualizada do imóvel como prova de titularidade de quem anuncia (aprovado pelo Daniel, 05/11/2026;
  reunião com a Dra. Beatriz). PURO: textos e a regra do item da lista de prontidão.
   • NASCE OPCIONAL: não bloqueia a publicação.
   • Só vira obrigatória com a chave MATRICULA_OBRIGATORIA (flags.ts), que só se liga com a confirmação POR ESCRITO da
     Dra. Beatriz (item 38 da pauta dela).
   • Exceções documentadas (inventariante, herdeiros, contrato de gaveta) entram pelos "casos" da matrícula
     (conferencia-matricula.ts → CASOS_DONO) e caem em REVISÃO MANUAL (resultado em_revisao).
*/

export const ROTULO_MATRICULA_ATUALIZADA = "Matrícula atualizada do imóvel";

/** O custo da certidão é dito à pessoa: ela decide com a informação inteira. */
export const DICA_MATRICULA_ATUALIZADA =
  "Prova de que o imóvel é seu. A certidão atualizada custa cerca de R$ 35 no cartório de registro de imóveis.";

export const TEXTO_MATRICULA_OPCIONAL =
  "A matrícula atualizada é opcional por enquanto: você publica sem ela. Se o imóvel não está só no seu nome (inventário, herdeiros, contrato de gaveta), escolha o seu caso ao enviar: a equipe confere em até 48 horas.";

/** Como a prontidão detalha o item quando falta. */
export const DETALHE_MATRICULA_FALTA = "opcional — a certidão custa cerca de R$ 35 no cartório";
export const DETALHE_MATRICULA_OBRIGATORIA = "a certidão custa cerca de R$ 35 no cartório";
