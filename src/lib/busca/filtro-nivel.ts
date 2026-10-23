/*
  Adendo 59.1 — filtro "a partir de" nível na busca (PURO). `?nivel=conforto` mostra Conforto e Premium; `?nivel=premium`,
  só Premium. Usa o nível gravado pelo servidor (elo mais fraco). Nível não compra posição: o filtro só tira da lista.
*/
import type { Nivel } from "../../config/niveis.ts";

const VALIDOS: readonly Nivel[] = ["conforto", "premium"];

export function filtroNivelDaUrl(sp: { get(k: string): string | null }): Nivel | "" {
  const v = sp.get("nivel") ?? "";
  return (VALIDOS as readonly string[]).includes(v) ? (v as Nivel) : "";
}

export function filtroNivelNaUrl(params: URLSearchParams, nivel: Nivel | ""): void {
  if (nivel && (VALIDOS as readonly string[]).includes(nivel)) params.set("nivel", nivel);
  else params.delete("nivel");
}
