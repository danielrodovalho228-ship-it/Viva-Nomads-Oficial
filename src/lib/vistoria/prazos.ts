/*
  E1118 (ORDEM-DUET-506) — a fonte única dos prazos da avaliação de imóveis, em horas. Módulo folha (não importa
  nada), para a regra, as ações, os e-mails e as telas lerem o MESMO número: texto com o prazo escrito à mão não entra
  (trava: e1118-prazos-sem-literal.test.ts).
  O prazo de reagendar tem a sua própria fonte: REGRAS_AGENDA.antecedenciaReagendarHoras (regras.ts).
*/

/** E682: prazo de resposta do avaliador quando ele não declarou o dele. */
export const PRAZO_RESPOSTA_PADRAO_HORAS = 24;
/** E682: o máximo que o avaliador pode declarar como prazo de resposta. */
export const PRAZO_RESPOSTA_MAX_HORAS = 72;
/** E682 (refino): prazo do DONO para aceitar a proposta do avaliador (decisão do Daniel em 07/11/2026). Passado, a escolha volta ao dono. */
export const PRAZO_DONO_ACEITAR_HORAS = 72;
