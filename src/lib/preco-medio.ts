/*
  Preços médios por cidade (ordem 09e730c3, Pacote FF 2). Módulo puro: recebe os
  anúncios e devolve o valor médio por mês por bairro e nº de quartos. Só entram
  anúncios REAIS publicados (exemplo fica de fora) e só aparece média de grupo com
  pelo menos 3 anúncios; abaixo disso, "dados insuficientes". Nunca expõe dado pessoal.
*/
import { isExemplo } from "./demo-listing.ts";
import { chaveCidade } from "./cidades.ts";

export const MINIMO_ANUNCIOS_POR_GRUPO = 3;

export interface ImovelParaMedia {
  id: string;
  neighborhood: string;
  bedrooms: number;
  monthlyPrice: number;
  status?: string;
}

export interface GrupoPrecoMedio {
  bairro: string;
  quartos: number;
  anuncios: number;
  /** Valor médio por mês (R$, inteiro); null quando há menos de 3 anúncios. */
  media: number | null;
}

export function calcularPrecosMedios(imoveis: readonly ImovelParaMedia[]): GrupoPrecoMedio[] {
  const grupos = new Map<string, { bairro: string; quartos: number; valores: number[] }>();
  for (const p of imoveis) {
    if (isExemplo(p.id)) continue;
    if (p.status && p.status !== "active") continue;
    if (!(p.monthlyPrice > 0) || !p.neighborhood?.trim()) continue;
    const quartos = Math.max(0, Math.trunc(p.bedrooms || 0));
    const chave = `${chaveCidade(p.neighborhood)}|${quartos}`;
    const g = grupos.get(chave) ?? { bairro: p.neighborhood.trim(), quartos, valores: [] };
    g.valores.push(p.monthlyPrice);
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .map((g) => ({
      bairro: g.bairro,
      quartos: g.quartos,
      anuncios: g.valores.length,
      media:
        g.valores.length >= MINIMO_ANUNCIOS_POR_GRUPO
          ? Math.round(g.valores.reduce((a, b) => a + b, 0) / g.valores.length)
          : null,
    }))
    .sort((a, b) => a.bairro.localeCompare(b.bairro, "pt-BR") || a.quartos - b.quartos);
}

export function rotuloQuartos(q: number): string {
  return q === 0 ? "Studio" : q === 1 ? "1 quarto" : `${q} quartos`;
}
