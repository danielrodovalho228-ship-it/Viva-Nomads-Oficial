/*
  E698 — a última foto conhecida do avatar da conta, guardada no navegador (sessionStorage) para a 1ª pintura do
  cabeçalho já mostrar a foto em vez de iniciais que trocam pela foto segundos depois. Por conta; qualquer falha do
  storage (bloqueado, cheio, modo privado) é ignorada. A leitura do servidor continua sendo a verdade e atualiza/limpa.
*/
type Armazem = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const chaveFotoAvatar = (userId: string) => `vn:foto-avatar:${userId}`;

function armazemPadrao(): Armazem | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function lerFotoAvatar(userId: string | undefined | null, armazem: Armazem | null = armazemPadrao()): string | null {
  if (!userId || !armazem) return null;
  try {
    return armazem.getItem(chaveFotoAvatar(userId)) || null;
  } catch {
    return null;
  }
}

export function gravarFotoAvatar(userId: string | undefined | null, url: string | null, armazem: Armazem | null = armazemPadrao()): void {
  if (!userId || !armazem) return;
  try {
    if (url) armazem.setItem(chaveFotoAvatar(userId), url);
    else armazem.removeItem(chaveFotoAvatar(userId));
  } catch {
    /* storage indisponível: segue sem cache */
  }
}
