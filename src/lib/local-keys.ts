/**
 * Chaves do navegador (localStorage/sessionStorage) — privacidade entre contas.
 *
 * T1/T11: o rascunho do anúncio e os favoritos ficavam numa chave GLOBAL, sem
 * dono, e sobreviviam ao logout — uma conta nova no mesmo navegador abria o
 * rascunho (fotos, rua, CEP) de OUTRA conta. Agora:
 *   • o rascunho local usa chave POR USUÁRIO;
 *   • no signOut, TODAS as chaves `vivanomads-*` são apagadas.
 * A fonte de verdade continua sendo o servidor (draft_data / favoritos no banco).
 */
const PREFIXO = "vivanomads-";

/** Chave antiga (global, sem dono) — só para apagar se ainda existir. */
export const DRAFT_KEY_LEGADO = "vivanomads-novo-draft";

/** Chave do rascunho local do anúncio, amarrada ao usuário logado. */
export function draftKey(userId: string): string {
  return `${DRAFT_KEY_LEGADO}:${userId}`;
}

/** Apaga todas as chaves `vivanomads-*` do navegador (logout). */
export function limparChavesLocais(): void {
  if (typeof window === "undefined") return;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const chaves: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(PREFIXO)) chaves.push(k);
      }
      chaves.forEach((k) => store.removeItem(k));
    } catch {
      /* storage indisponível (modo privado) — nada a limpar */
    }
  }
}
