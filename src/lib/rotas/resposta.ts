/*
  O que a API de tempos devolve ao navegador (Prompt 37) — PURO. Só o resultado ARREDONDADO:
   • minutos em múltiplos de 5 (0 = "menos de 5 min"), nunca os minutos/metros exatos;
   • a distância em linha reta medida com a coordenada APROXIMADA da página pública (até ~360 m do real), uma casa;
   • a ordem por tempo vem como posição (1, 2, 3…), calculada no servidor com o tempo exato — o número exato não sai.
  Nunca lat/lng do imóvel. O teste de privacidade confere as chaves de cada item.
*/
import { arredondarMinutos, rotuloLinhaReta, rotuloTempo, type Modo } from "./tempo.ts";
import { distanciaKm, temCoordenada, type Ponto } from "./selecao.ts";

export type FonteTempo = "rotas" | "linha_reta" | "limite";

export interface ItemTempoPublico {
  id: string;
  /** Minutos arredondados (múltiplo de 5; 0 = menos de 5). null = sem tempo (linha reta ou calculando). */
  minutos: number | null;
  /** "~15 min de carro até o HC-UFU" | "" */
  texto: string;
  /** "≈ 3,2 km em linha reta" | "" (imóvel sem ponto) */
  linhaReta: string;
  /** Posição por tempo (1 = mais perto). null sem tempo. */
  ordem: number | null;
  /** Ainda não calculado (vai entrar na próxima rodada). */
  calculando: boolean;
}

export interface RespostaTempos {
  ok: true;
  modo: Modo;
  destino: { rotulo: string };
  fonte: FonteTempo;
  /** Quantos ainda faltam calcular (a tela pede de novo sozinha). */
  pendentes: number;
  itens: ItemTempoPublico[];
}

export const CHAVES_ITEM_PUBLICO = ["id", "minutos", "texto", "linhaReta", "ordem", "calculando"] as const;

export function montarResposta(o: {
  modo: Modo;
  destino: { rotulo: string; artigo?: "o" | "a" | null; ponto: Ponto };
  fonte: FonteTempo;
  /** Imóveis com a coordenada APROXIMADA (a mesma da página pública). */
  imoveis: { id: string; lat?: number | null; lng?: number | null }[];
  /** Tempo exato por imóvel (do cache ou do provedor) — fica no servidor. */
  tempos: Map<string, { minutos: number } | null>;
  /** Ids que ainda vão ser calculados. */
  pendentes: Set<string>;
}): RespostaTempos {
  const ordenados = [...o.tempos.entries()]
    .filter((e): e is [string, { minutos: number }] => !!e[1] && Number.isFinite(e[1].minutos))
    .sort((a, b) => a[1].minutos - b[1].minutos || (a[0] < b[0] ? -1 : 1));
  const posicao = new Map(ordenados.map(([id], i) => [id, i + 1]));
  const itens: ItemTempoPublico[] = o.imoveis.map((p) => {
    const t = o.tempos.get(p.id);
    const minutos = t ? arredondarMinutos(t.minutos) : null;
    return {
      id: p.id,
      minutos,
      texto: minutos != null ? rotuloTempo({ minutos, modo: o.modo, destinoRotulo: o.destino.rotulo, artigo: o.destino.artigo }) : "",
      linhaReta: temCoordenada(p) ? rotuloLinhaReta(distanciaKm(o.destino.ponto, p)) : "",
      ordem: minutos != null ? (posicao.get(p.id) ?? null) : null,
      calculando: minutos == null && o.pendentes.has(p.id),
    };
  });
  return { ok: true, modo: o.modo, destino: { rotulo: o.destino.rotulo }, fonte: o.fonte, pendentes: o.pendentes.size, itens };
}

/** Distância em linha reta (km, uma casa) para ordenar quem não tem tempo — da coordenada aproximada. */
export function kmDaLinhaReta(texto: string): number {
  const m = texto.match(/([\d]+,\d)\s*km/);
  return m ? Number(m[1].replace(",", ".")) : Number.POSITIVE_INFINITY;
}
