/**
 * L-105 (E679, migração 0322): avaliação com status diferente de "rascunho" só entra com os TRÊS critérios fixos do par em
 * `notas_categorias` e com `recomendaria` preenchido. Espalhe no insert: `{ ...criteriosDaAvaliacao("inquilino"), nota_geral: 5, ... }`.
 * Arquivo sem dependência de ambiente: as specs que não importam o laboratorio.ts podem usá-lo.
 */
export function criteriosDaAvaliacao(papelAutor: "inquilino" | "proprietario", nota = 5): { notas_categorias: Record<string, number>; recomendaria: boolean } {
  const chaves = papelAutor === "inquilino" ? ["imovel_como_anuncio", "limpeza_chegada", "comunicacao"] : ["cuidado_imovel", "regras_casa", "comunicacao"];
  return { notas_categorias: Object.fromEntries(chaves.map((k) => [k, nota])), recomendaria: true };
}
