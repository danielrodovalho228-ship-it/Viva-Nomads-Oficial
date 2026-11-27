/*
  E874 — o índice de cidades (/cidades) e a página da cidade SEM operação. PURO (a lista do IBGE entra por parâmetro).
  • Índice: cada cidade liberada com a MESMA contagem da página dela (a base da vitrine) e o detalhe reais × exemplo.
  • Slug que é município de verdade mas sem operação (/cidades/sao-paulo): não é 404 seco — a página diz que a Viva
    ainda não opera ali e dá os próximos passos. Slug que não é município (/cidades/xpto123) segue 404.
*/
import { chaveCidade, detalheContagemCidade } from "./cidades.ts";

/** "São Paulo" → "sao-paulo" (o mesmo formato dos slugs de CITIES). */
export function slugDaCidade(nome: string): string {
  return chaveCidade(nome).replace(/'/g, "").replace(/\s+/g, "-");
}

/** Municípios do IBGE com este slug (homônimos em UFs diferentes voltam todos). */
export function municipiosDoSlug(slug: string, municipios: Record<string, readonly string[]>): { cidade: string; uf: string }[] {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return [];
  const achados: { cidade: string; uf: string }[] = [];
  for (const [uf, nomes] of Object.entries(municipios)) for (const n of nomes) if (slugDaCidade(n) === slug) achados.push({ cidade: n, uf });
  return achados.sort((a, b) => a.uf.localeCompare(b.uf));
}

/** "São Paulo" (uma UF) ou "Bom Jesus" (homônimos: sem UF, a página lista as UFs). */
export function nomeSemOperacao(achados: { cidade: string; uf: string }[]): string | null {
  return achados.length ? achados[0].cidade : null;
}

export interface LinhaIndiceCidade {
  slug: string;
  nome: string;
  uf: string;
  total: number;
  rotulo: string; // "15 imóveis" / "1 imóvel" / "Sem imóveis no momento"
  detalhe: string | null; // "Todos são anúncios de exemplo…" (o mesmo da página da cidade)
}

export function linhaIndiceCidade(c: { slug: string; name: string; state: string }, reais: number, exemplos: number): LinhaIndiceCidade {
  const total = reais + exemplos;
  return {
    slug: c.slug,
    nome: c.name,
    uf: c.state,
    total,
    rotulo: total === 0 ? "Sem imóveis no momento" : `${total} ${total === 1 ? "imóvel" : "imóveis"}`,
    detalhe: detalheContagemCidade(reais, exemplos),
  };
}
