/*
  Páginas de bairro (ordem 7000fbe0, telas 5–6). Módulo puro: o bairro existe só se tem
  anúncio REAL publicado (sem imóvel, some). Sem endereço e sem coordenada exata: o centro
  do bairro é a média das coordenadas JÁ aproximadas e arredondada de novo (~110 m).
  Distância = linha reta entre o centro aproximado e um ponto público, arredondada.
*/
import { chaveCidade, mesmaCidade } from "./cidades.ts";

export interface BairroResumo {
  slug: string;
  nome: string;
  total: number;
}

interface ImovelBairro {
  id: string;
  neighborhood: string;
  lat: number;
  lng: number;
}

/** "Santa Mônica" → "santa-monica". Vazio se não sobrar letra. */
export function slugBairro(nome: string | null | undefined): string {
  return chaveCidade(nome).replace(/[' ]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Bairros com pelo menos 1 anúncio real, do mais cheio para o mais vazio (empate: ordem alfabética). */
export function agruparBairros(imoveis: readonly ImovelBairro[], ehExemplo: (id: string) => boolean): BairroResumo[] {
  const mapa = new Map<string, BairroResumo>();
  for (const i of imoveis) {
    if (ehExemplo(i.id)) continue;
    const slug = slugBairro(i.neighborhood);
    if (!slug) continue;
    const atual = mapa.get(slug);
    if (atual) atual.total += 1;
    else mapa.set(slug, { slug, nome: i.neighborhood.trim(), total: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Grade PAR (2 colunas sem cartão sozinho na última linha): com número ímpar (>1), o menos cheio fica de fora da grade. */
export function limitarAPar<T>(lista: readonly T[]): T[] {
  return lista.length > 1 && lista.length % 2 === 1 ? lista.slice(0, -1) : [...lista];
}

export function imoveisDoBairro<T extends { id: string; neighborhood: string }>(slug: string, imoveis: readonly T[], ehExemplo: (id: string) => boolean): T[] {
  return imoveis.filter((i) => !ehExemplo(i.id) && slugBairro(i.neighborhood) === slug);
}

const arredondar3 = (n: number) => Math.round(n * 1000) / 1000;

/** Centro aproximado do bairro (média arredondada), ou null se nenhum imóvel tem coordenada. */
export function centroDoBairro(imoveis: readonly { lat: number; lng: number }[]): { lat: number; lng: number } | null {
  const com = imoveis.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng) && (i.lat !== 0 || i.lng !== 0));
  if (com.length === 0) return null;
  const lat = com.reduce((s, i) => s + i.lat, 0) / com.length;
  const lng = com.reduce((s, i) => s + i.lng, 0) / com.length;
  return { lat: arredondar3(lat), lng: arredondar3(lng) };
}

/** Distância em linha reta (km), fórmula de haversine. */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface DistanciaPonto {
  slug: string;
  nome: string;
  km: number;
  texto: string; // "~1,5 km em linha reta"
}

/** Distâncias aos pontos CONFERIDOS da cidade (verificado=false não entra). Arredonda a 0,5 km (mín. 0,5). */
export function distanciasDoBairro(
  centro: { lat: number; lng: number } | null,
  pontos: readonly { slug: string; nome: string; lat: number; lng: number; verificado: boolean }[],
): DistanciaPonto[] {
  if (!centro) return [];
  return pontos
    .filter((p) => p.verificado && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => {
      const km = Math.max(0.5, Math.round(distanciaKm(centro, p) * 2) / 2);
      return { slug: p.slug, nome: p.nome, km, texto: `~${km.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} km em linha reta` };
    })
    .sort((a, b) => a.km - b.km);
}

/** Texto próprio do bairro (da Viva): só fatos do cadastro, sem número de mercado. */
export function resumoDoBairro(nome: string, cidade: string, total: number): string {
  const n = total === 1 ? "1 imóvel mobiliado publicado" : `${total} imóveis mobiliados publicados`;
  return `${nome}, em ${cidade}: ${n} na Viva Nomads para estadias de 30 a 180 dias. O mapa mostra só a área aproximada; o endereço exato é liberado depois do aceite.`;
}

export function perguntasDoBairro(nome: string, cidade: string, mediaGeral: number | null): { q: string; a: string }[] {
  return [
    {
      q: `Há imóveis mobiliados em ${nome}, ${cidade}?`,
      a: `Sim. Os imóveis do Viva Nomads em ${nome} são mobiliados e a estadia é de 30 a 180 dias, com contrato registrado na plataforma.`,
    },
    {
      q: `Quanto custa por mês em ${nome}?`,
      a:
        mediaGeral === null
          ? "Ainda não há anúncios suficientes no bairro para mostrar um valor médio. Quando houver pelo menos 3 anúncios no mesmo grupo, a média aparece aqui."
          : `A média dos anúncios publicados no bairro é de R$ ${mediaGeral.toLocaleString("pt-BR")} por mês. Cada imóvel mostra o valor mensal e as contas incluídas.`,
    },
    {
      q: "A Viva Nomads recebe o pagamento?",
      a: "Não. O valor combinado vai direto ao proprietário; a plataforma não toca em dinheiro. A conversa e o contrato ficam registrados.",
    },
  ];
}

/** Caminhos de bairro para o sitemap: só bairros com anúncio real, sem repetir. */
export function caminhosDeBairros(
  cidades: readonly { slug: string; name: string }[],
  imoveis: readonly (ImovelBairro & { city: string })[],
  ehExemplo: (id: string) => boolean,
): string[] {
  return cidades.flatMap((c) =>
    agruparBairros(imoveis.filter((i) => mesmaCidade(i.city, c.name)), ehExemplo).map((b) => `/cidades/${c.slug}/${b.slug}`),
  );
}
