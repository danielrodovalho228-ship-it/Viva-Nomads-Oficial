/*
  E471 — a URL dos filtros do admin (período, cidade e o que a página mantém, ex.: o recorte). Puro, sem imports @/.
*/
import type { Periodo } from "./visao-geral.ts";

export function urlFiltrosAdmin(
  base: string,
  periodo: Pick<Periodo, "id" | "inicio" | "fim">,
  cidade: string | null,
  manter: Record<string, string | null> | undefined,
  extra: Record<string, string | null>,
): string {
  const valores: Record<string, string | null> = {
    periodo: periodo.id,
    de: periodo.id === "custom" ? periodo.inicio : null,
    ate: periodo.id === "custom" ? periodo.fim : null,
    cidade,
    ...manter,
    ...extra,
  };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(valores)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}
