import type { SessionUser, ViewMode } from "../store";
import type { OndaPainelSessaoServidor } from "../flags";

/**
 * E793 — regras PURAS do painel desenhado no servidor (sem React, sem servidor): o que o layout entrega ao cliente, as
 * rotas de cada onda (A6), a escolha do usuário/modo do quadro (A4) e a semeadura do store (A5).
 */

/** O que o layout do painel entrega ao cliente quando a chave está ligada e a sessão foi lida no servidor. */
export interface SessaoDoServidor {
  usuario: SessionUser;
  modoInicial: ViewMode | null;
  /** Rotas da onda ligada: só nelas o AuthGuard libera o conteúdo no PRIMEIRO quadro (A6). */
  rotasLiberadas: readonly string[];
}

/**
 * A6: rotas liberadas no 1º quadro, por onda. Padrões com segmento dinâmico entre colchetes ("/dashboard/conta/[secao]")
 * casam um segmento qualquer; os demais são exatos. A Onda 0 só traz as peças: a lista do piloto entra no PR da Onda 1.
 */
export const ROTAS_DA_ONDA: Record<OndaPainelSessaoServidor, readonly string[]> = {
  off: [],
  piloto: [],
};

const segmentos = (p: string) => p.split("?")[0].split("#")[0].replace(/\/+$/, "").split("/").filter(Boolean);

/** A rota atual está na lista? Exato por segmento; "[x]" casa um segmento (não vazio). */
export function rotaLiberada(pathname: string | null | undefined, rotas: readonly string[]): boolean {
  if (!pathname) return false;
  const atual = segmentos(pathname);
  return rotas.some((padrao) => {
    const p = segmentos(padrao);
    return p.length === atual.length && p.every((s, i) => (/^\[[^\]]+\]$/.test(s) ? atual[i].length > 0 : s === atual[i]));
  });
}

/**
 * A4 — o usuário do quadro. No servidor e no 1º render do cliente (hidratação, `montado` falso): SÓ o do contexto do
 * servidor — nunca o do store persistido no localStorage (que pode ser de outra conta, ou velho). Depois de montado:
 * enquanto a conferência do cliente não terminou (`authChecked` falso), contexto ?? store; depois dela, o store.
 */
export function escolherUsuario(p: { montado: boolean; authChecked: boolean; contexto: SessionUser | null; store: SessionUser | null }): SessionUser | null {
  if (!p.montado) return p.contexto;
  if (!p.authChecked) return p.contexto ?? p.store;
  return p.store;
}

/** A4 — o modo do quadro, pela mesma regra. */
export function escolherModo(p: { montado: boolean; authChecked: boolean; contexto: ViewMode | null; store: ViewMode | null }): ViewMode | null {
  if (!p.montado) return p.contexto;
  if (!p.authChecked) return p.contexto ?? p.store;
  return p.store;
}

/**
 * A5 — semear o store com o usuário do servidor (só no cliente, depois de montar): store vazio ou de OUTRA conta → sim
 * (o setUser já trata a troca de conta: favoritos, modo, papel e relógio de 24h); mesma conta → não sobrescreve (o
 * store pode ter campos que o servidor não lê).
 */
export function deveSemear(store: SessionUser | null, contexto: SessionUser | null): boolean {
  if (!contexto) return false;
  return !store || store.id !== contexto.id;
}
