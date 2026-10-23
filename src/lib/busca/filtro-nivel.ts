/*
  Adendo 59.1 — filtro "a partir de" nível na busca (PURO). `?nivel=essencial` mostra os anúncios com nível calculado;
  `?nivel=conforto` mostra Conforto e Premium; `?nivel=premium`, só Premium. Usa o nível gravado pelo servidor (elo mais fraco). Nível não compra posição: o filtro só tira da lista.
*/
import { ROTULO_NIVEL, type Nivel } from "../../config/niveis.ts";

const VALIDOS: readonly Nivel[] = ["essencial", "conforto", "premium"];

export function filtroNivelDaUrl(sp: { get(k: string): string | null }): Nivel | "" {
  const v = sp.get("nivel") ?? "";
  return (VALIDOS as readonly string[]).includes(v) ? (v as Nivel) : "";
}

/** Rótulo do resumo dos filtros: "Nível Conforto ou acima" / "Nível Premium". */
export function rotuloFiltroNivel(nivel: Nivel | "" | undefined): string | null {
  if (!nivel) return null;
  return nivel === "premium" ? "Nível Premium" : `Nível ${ROTULO_NIVEL[nivel]} ou acima`;
}

export function filtroNivelNaUrl(params: URLSearchParams, nivel: Nivel | ""): void {
  if (nivel && (VALIDOS as readonly string[]).includes(nivel)) params.set("nivel", nivel);
  else params.delete("nivel");
}
