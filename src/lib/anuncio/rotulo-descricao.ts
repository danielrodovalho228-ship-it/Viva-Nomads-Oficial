/**
 * E257 (Parte 2) — regra única da descrição dos cartões do assistente de cadastro: dentro de cada grupo de cartões, ou
 * TODOS têm a descrição curta, ou o grupo é só título. Nunca misturado (um cartão com descrição ao lado de outro sem).
 * A Parte 1 (#1572) acertou quatro grupos dos Passos 5 e 6; esta parte dá a regra a todos os grupos dos dois passos.
 */
export type ItemDoGrupo = { rotulo: string; descricao?: string | null };

/** "todos" / "nenhum" quando o grupo é consistente; "misto" quando só parte dos cartões tem descrição. */
export function modoDaDescricao(itens: readonly ItemDoGrupo[]): "todos" | "nenhum" | "misto" {
  const com = itens.filter((i) => typeof i.descricao === "string" && i.descricao.trim().length > 0).length;
  if (com === 0) return "nenhum";
  return com === itens.length ? "todos" : "misto";
}

/** Os grupos que misturam cartões com e sem descrição (lista vazia = tudo certo). */
export function gruposMistos(grupos: Record<string, readonly ItemDoGrupo[]>): string[] {
  return Object.entries(grupos)
    .filter(([, itens]) => modoDaDescricao(itens) === "misto")
    .map(([nome]) => nome);
}
