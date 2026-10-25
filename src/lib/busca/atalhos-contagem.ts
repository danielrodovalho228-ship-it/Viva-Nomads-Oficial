/*
  Contagem dos atalhos rápidos da home (ordem a875278a, "Próximo do FF" 1/6) — PURO.
  Cada atalho abre a /buscar com um filtro que a busca já lê da URL; aqui a contagem
  usa a MESMA regra (passaNoPainel para preço/quartos/pet/home office; texto de local
  para bairro/cidade). Sem número inventado: atalho com 0 imóveis some.
*/
import { comodidadesDaUrl } from "./filtro-comodidades.ts";
import { FILTROS_PAINEL_VAZIOS, passaNoPainel } from "./painel-filtros.ts";
import { baseDaBusca, contarNaBase } from "./exemplos-e-pedido.ts";

type ImovelContavel = Parameters<typeof passaNoPainel>[0] & { neighborhood: string; city: string; maxGuests?: number | null };
/** Como a /buscar decide se um imóvel é de exemplo (a home passa `(p) => isExemplo(p.id)`). */
type EhExemplo<T> = (p: T) => boolean;
type AtalhoBase = { href: string };

/**
 * Quantos imóveis a /buscar mostraria ao abrir este atalho — a MESMA sequência da /buscar: filtro de base
 * (local; capacidade para 1 morador), a regra "com imóvel real na busca, os exemplos saem" (Prompt 30) decidida
 * sobre essa base (E131: uma vez, como a /buscar) e só então passaNoPainel. Sem a regra, a home contava os exemplos
 * que a /buscar esconde (t162, #978).
 */
export function contarAtalho<T extends ImovelContavel>(href: string, imoveis: T[], ehExemplo: EhExemplo<T> = () => false): number {
  const sp = new URL(href, "https://x").searchParams;
  const orcamento = Number(sp.get("preco")) || Number(sp.get("orcamento")) || 0;
  const quartos = Number(sp.get("quartos")) || 0;
  const local = (sp.get("local") ?? "").trim().toLowerCase();
  const filtros = {
    ...FILTROS_PAINEL_VAZIOS,
    maxPrice: orcamento,
    minBedrooms: quartos,
    petsOnly: sp.get("pet") === "1",
    homeOfficeOnly: sp.get("homeoffice") === "1",
    comodidades: comodidadesDaUrl(sp.get("comod")),
  };
  const base = imoveis.filter((p) => {
    if (local && !`${p.neighborhood} ${p.city}`.toLowerCase().includes(local)) return false;
    // A /buscar abre com 1 morador: imóvel com capacidade conhecida menor que isso não aparece lá.
    return !(p.maxGuests != null && p.maxGuests < 1);
  });
  return contarNaBase(baseDaBusca(base, ehExemplo), (p) => passaNoPainel(p, filtros));
}

/** Atalhos com contagem real; os que dariam 0 imóveis ficam de fora. */
export function atalhosComContagem<T extends AtalhoBase, I extends ImovelContavel>(
  atalhos: readonly T[],
  imoveis: I[],
  ehExemplo: EhExemplo<I> = () => false
): (T & { total: number })[] {
  return atalhos.map((a) => ({ ...a, total: contarAtalho(a.href, imoveis, ehExemplo) })).filter((a) => a.total > 0);
}
