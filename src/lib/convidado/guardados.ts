/*
  Prompt 49 — convidado sem conta (PURO). Favoritos e buscas salvas de quem ainda não entrou ficam NO APARELHO
  (localStorage, sempre em try/catch); sem armazenamento, a ação pede a conta. Ao entrar ou criar conta, a lista do
  aparelho é mesclada com a da conta SEM duplicar e a cópia local some.
*/

export const CHAVE_BUSCAS_CONVIDADO = "vivanomads-buscas-convidado";
/** Teto do que o aparelho guarda (o resto é ignorado ao mesclar). */
export const MAX_GUARDADOS_CONVIDADO = 50;

/** Lê uma lista de textos guardada (JSON); lixo vira lista vazia, repetidos somem. */
export function lerLista(bruto: string | null | undefined): string[] {
  if (!bruto) return [];
  try {
    const v: unknown = JSON.parse(bruto);
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 1000))].slice(0, MAX_GUARDADOS_CONVIDADO);
  } catch {
    return [];
  }
}

/** O coração alterna: tira se está, põe no fim se não está. */
export function alternarNaLista(lista: string[], item: string): string[] {
  return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item].slice(-MAX_GUARDADOS_CONVIDADO);
}

/** Mescla sem duplicar: `novos` = o que só o aparelho tinha (gravar na conta); `todos` = a conta + os novos. */
export function mesclarSemDuplicar(doAparelho: string[], daConta: string[]): { novos: string[]; todos: string[] } {
  const conta = new Set(daConta);
  const novos = [...new Set(doAparelho)].filter((x) => !conta.has(x));
  return { novos, todos: [...daConta, ...novos] };
}

/** O navegador deixa guardar? (modo privado/bloqueado dá erro ao gravar). */
export function armazenamentoDisponivel(st: Pick<Storage, "setItem" | "removeItem"> | null | undefined): boolean {
  if (!st) return false;
  try {
    st.setItem("vivanomads-teste-armazenamento", "1");
    st.removeItem("vivanomads-teste-armazenamento");
    return true;
  } catch {
    return false;
  }
}

/** localStorage do navegador, ou null (servidor, modo privado que recusa o acesso). */
export function armazenamentoDoNavegador(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
