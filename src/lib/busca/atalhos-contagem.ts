/*
  Contagem dos atalhos rápidos da home (ordem a875278a, "Próximo do FF" 1/6) — PURO.
  Cada atalho abre a /buscar com um filtro que a busca já lê da URL; aqui a contagem
  usa a MESMA regra (passaNoPainel para preço/quartos/pet/home office; texto de local
  para bairro/cidade). Sem número inventado: atalho com 0 imóveis some.
*/
import { FILTROS_PAINEL_VAZIOS, passaNoPainel } from "./painel-filtros.ts";

type ImovelContavel = Parameters<typeof passaNoPainel>[0] & { neighborhood: string; city: string };
type AtalhoBase = { href: string };

/** Quantos imóveis a /buscar mostraria ao abrir este atalho. */
export function contarAtalho(href: string, imoveis: ImovelContavel[]): number {
  const sp = new URL(href, "https://x").searchParams;
  const orcamento = Number(sp.get("orcamento")) || 0;
  const quartos = Number(sp.get("quartos")) || 0;
  const local = (sp.get("local") ?? "").trim().toLowerCase();
  const filtros = {
    ...FILTROS_PAINEL_VAZIOS,
    maxPrice: orcamento,
    minBedrooms: quartos,
    petsOnly: sp.get("pet") === "1",
    homeOfficeOnly: sp.get("homeoffice") === "1",
  };
  return imoveis.filter((p) => {
    if (local && !`${p.neighborhood} ${p.city}`.toLowerCase().includes(local)) return false;
    return passaNoPainel(p, filtros);
  }).length;
}

/** Atalhos com contagem real; os que dariam 0 imóveis ficam de fora. */
export function atalhosComContagem<T extends AtalhoBase>(atalhos: readonly T[], imoveis: ImovelContavel[]): (T & { total: number })[] {
  return atalhos.map((a) => ({ ...a, total: contarAtalho(a.href, imoveis) })).filter((a) => a.total > 0);
}
