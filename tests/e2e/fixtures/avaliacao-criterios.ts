/*
  E679 — a migração 0322 exige, ao ENVIAR uma avaliação, os três critérios do par (1 a 5) e o "recomendaria". Os specs que
  gravam avaliação direto no banco usam estes valores (chaves de src/lib/avaliacoes-criterios.ts), e os que preenchem o
  formulário usam `preencherCriterios`.
*/
import type { Page } from "@playwright/test";

export const CRITERIOS_MORADOR = { imovel_como_anuncio: 4, limpeza_chegada: 4, comunicacao: 4 };
export const CRITERIOS_DONO = { cuidado_imovel: 4, regras_casa: 4, comunicacao: 4 };

/** Campos extras do insert direto: critérios do par e "recomendaria". */
export function camposDoPar(papel: "inquilino" | "proprietario") {
  return { notas_categorias: papel === "inquilino" ? CRITERIOS_MORADOR : CRITERIOS_DONO, recomendaria: true };
}

/** No formulário aberto: 5 estrelas em cada critério e "Sim" em "recomendaria". */
export async function preencherCriterios(p: Page) {
  const fieldset = p.getByTestId("avaliacao-criterios");
  for (const radio of await fieldset.getByRole("radio", { name: /: 5$/ }).all()) await radio.click();
  await p.getByRole("radiogroup", { name: "Recomendaria" }).getByRole("radio", { name: "Sim" }).click();
}

/*
  L-105 (Pista C, mesma regra da 0322): forma equivalente a `camposDoPar`, usada pelos specs que já a importam.
*/
export function criteriosDaAvaliacao(papelAutor: "inquilino" | "proprietario", nota = 5): { notas_categorias: Record<string, number>; recomendaria: boolean } {
  const chaves = papelAutor === "inquilino" ? ["imovel_como_anuncio", "limpeza_chegada", "comunicacao"] : ["cuidado_imovel", "regras_casa", "comunicacao"];
  return { notas_categorias: Object.fromEntries(chaves.map((k) => [k, nota])), recomendaria: true };
}
