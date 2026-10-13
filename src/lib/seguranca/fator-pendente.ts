/**
 * Fator TOTP ainda não verificado (ordens fc458aa7 / be6f2ae0).
 * O Supabase só devolve o QR/segredo no momento do `enroll`. Para o QR NÃO mudar
 * a cada abertura da tela, guardamos o resultado do enroll na aba (sessionStorage)
 * e só o reaproveitamos enquanto o fator continua não verificado no servidor.
 * Nunca recria fator no carregamento da página.
 */
export const CHAVE_FATOR_PENDENTE = "vn:2fa-pendente";

export type FatorPendente = { factorId: string; qr: string; segredo: string };

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function gravarPendente(st: Armazenamento | null, p: FatorPendente): void {
  try {
    st?.setItem(CHAVE_FATOR_PENDENTE, JSON.stringify(p));
  } catch {
    /* sem armazenamento: cai no fluxo de gerar novo QR */
  }
}

export function limparPendente(st: Armazenamento | null): void {
  try {
    st?.removeItem(CHAVE_FATOR_PENDENTE);
  } catch {
    /* ignora */
  }
}

/** Devolve o pendente guardado SÓ se o fator ainda existe não verificado no servidor. */
export function lerPendente(st: Armazenamento | null, idsNaoVerificados: string[]): FatorPendente | null {
  try {
    const bruto = st?.getItem(CHAVE_FATOR_PENDENTE);
    if (!bruto) return null;
    const p = JSON.parse(bruto) as Partial<FatorPendente>;
    if (typeof p.factorId !== "string" || typeof p.qr !== "string" || typeof p.segredo !== "string") return null;
    if (!idsNaoVerificados.includes(p.factorId)) return null;
    return { factorId: p.factorId, qr: p.qr, segredo: p.segredo };
  } catch {
    return null;
  }
}
