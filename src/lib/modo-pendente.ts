/*
  Modo (proprietário ⇄ inquilino) ainda não confirmado pelo servidor — bug 6 da L2.

  A troca de modo é local na hora e grava no perfil em seguida. Se a pessoa
  recarrega ou abre outra aba ANTES de a gravação chegar, o servidor ainda
  devolve o modo antigo e o ModeInitializer desfazia a troca. A escolha fica
  anotada aqui até o servidor confirmar; enquanto for recente, ela vence o
  valor do servidor (e é regravada). PURO: o armazenamento é injetado.
*/

export type Modo = "owner" | "tenant";

// Prefixo vivanomads-: o signOut (limparChavesLocais) apaga junto — não vaza para a próxima conta.
export const CHAVE_MODO_PENDENTE = "vivanomads-modo-pendente";
/** Depois disso a anotação é velha: vale o servidor (ex.: trocou em outro aparelho). */
export const VALIDADE_PENDENTE_MS = 10 * 60_000;

type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface ModoPendente {
  modo: Modo;
  em: number;
}

export function gravarPendente(s: Armazem | null, modo: Modo, agora = Date.now()): void {
  try {
    s?.setItem(CHAVE_MODO_PENDENTE, JSON.stringify({ modo, em: agora }));
  } catch {
    /* armazenamento indisponível: segue sem a anotação */
  }
}

export function lerPendente(s: Armazem | null, agora = Date.now()): ModoPendente | null {
  try {
    const v = JSON.parse(s?.getItem(CHAVE_MODO_PENDENTE) ?? "null") as Partial<ModoPendente> | null;
    if (!v || (v.modo !== "owner" && v.modo !== "tenant") || typeof v.em !== "number") return null;
    if (agora - v.em > VALIDADE_PENDENTE_MS || v.em > agora + 60_000) return null;
    return { modo: v.modo, em: v.em };
  } catch {
    return null;
  }
}

/** Limpa só se a anotação ainda é deste modo (outra troca pode ter vindo depois). */
export function limparPendente(s: Armazem | null, modo?: Modo): void {
  try {
    const atual = JSON.parse(s?.getItem(CHAVE_MODO_PENDENTE) ?? "null") as Partial<ModoPendente> | null;
    if (!modo || !atual || atual.modo === modo) s?.removeItem(CHAVE_MODO_PENDENTE);
  } catch {
    /* ignore */
  }
}

/**
 * Modo inicial da página: a escolha pendente recente vence o servidor;
 * `regravar` diz se é preciso mandar de novo ao servidor.
 */
export function decidirModoInicial(servidor: Modo | null, pendente: ModoPendente | null): { modo: Modo | null; regravar: boolean } {
  if (pendente && pendente.modo !== servidor) return { modo: pendente.modo, regravar: true };
  return { modo: servidor, regravar: false };
}
