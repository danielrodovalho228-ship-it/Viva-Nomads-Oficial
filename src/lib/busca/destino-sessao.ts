/*
  E79 — o destino ativo da busca vai junto para a página do imóvel. O cartão (property-card, da Pista A) não leva o
  destino no link; a busca guarda o destino na sessão do navegador e o bloco "Tempo até" lê de lá quando a URL não traz.
  Só nesta aba (sessionStorage); sem acesso (navegação privada), nada quebra: a página só não mostra o destino.
*/
import { corpoDoDestino, type DestinoBusca } from "./destino-busca.ts";
import type { ModoRota, Ponto } from "../rotas/tempo.ts";

export const CHAVE_DESTINO_SESSAO = "vn_destino_busca";

export interface DestinoDaSessao {
  /** Parâmetros no formato da URL (destino=slug ou dlat/dlng/drot) + modo. */
  params: Record<string, string>;
  /** Ponto e rótulo do destino (para a linha reta quando o servidor não traz). */
  alvo: { ponto: Ponto; rotulo: string } | null;
}

export function guardarDestinoDaBusca(destino: DestinoBusca | null, modo: ModoRota, alvo: { ponto: Ponto; rotulo: string } | null): void {
  try {
    if (!destino) return sessionStorage.removeItem(CHAVE_DESTINO_SESSAO);
    const v: DestinoDaSessao = { params: { ...corpoDoDestino(destino), modo }, alvo };
    sessionStorage.setItem(CHAVE_DESTINO_SESSAO, JSON.stringify(v));
  } catch {
    /* sem sessionStorage: segue sem levar o destino */
  }
}

export function lerDestinoDaBusca(): DestinoDaSessao | null {
  try {
    const raw = sessionStorage.getItem(CHAVE_DESTINO_SESSAO);
    if (!raw) return null;
    const v = JSON.parse(raw) as DestinoDaSessao;
    return v && typeof v === "object" && v.params && typeof v.params === "object" ? v : null;
  } catch {
    return null;
  }
}
