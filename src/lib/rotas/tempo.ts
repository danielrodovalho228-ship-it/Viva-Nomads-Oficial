/*
  Tempo até o trabalho (prompt 37) — regras PURAS.

  O tempo é calculado no servidor com o ponto exato do imóvel; aqui ficam só o arredondamento e os textos que
  vão à tela, a escolha dos candidatos antes da Matrix, os lotes, a chave do cache e o ponto da URL.
  Nunca há minutos inventados: sem tempo de rota, o texto é a distância em linha reta, dita como tal.
*/

export type ModoRota = "carro" | "a_pe" | "bicicleta" | "onibus";
export const MODOS: readonly ModoRota[] = ["carro", "a_pe", "bicicleta", "onibus"];
export const ROTULO_MODO: Record<ModoRota, string> = { carro: "Carro", a_pe: "A pé", bicicleta: "Bicicleta", onibus: "Ônibus" };
const MODO_NA_FRASE: Record<ModoRota, string> = { carro: "de carro", a_pe: "a pé", bicicleta: "de bicicleta", onibus: "de ônibus" };

/** Opções do filtro "até N min". */
export const ATE_OPCOES = [10, 15, 20, 30, 45] as const;
/** Quantos imóveis mais próximos em linha reta vão à Matrix quando o endereço é digitado. */
export const CANDIDATOS_POR_ENDERECO = 40;
/** A Matrix aceita até 25 coordenadas por chamada: 1 destino + 24 imóveis. */
export const COORDENADAS_POR_CHAMADA = 25;
export const VALIDADE_CACHE_DIAS = 30;
export const CALCULOS_POR_HORA_POR_IP = 300;

export const ehModo = (v: unknown): v is ModoRota => typeof v === "string" && (MODOS as readonly string[]).includes(v);

/** Minutos para cima, em múltiplos de 5; abaixo de 5, null ("menos de 5 min"). */
export function minutosArredondados(minutos: number): number | null {
  if (!Number.isFinite(minutos) || minutos < 5) return null;
  return Math.ceil(minutos / 5) * 5;
}

/** "o HC-UFU", "a UFU — Campus Umuarama", ou o rótulo do endereço digitado (sem artigo). */
export function comArtigo(nome: string, artigo: "o" | "a" | "" = ""): string {
  return artigo ? `${artigo} ${nome}` : nome;
}

/** "~15 min de carro até o HC-UFU"; "menos de 5 min a pé até a UFU — Campus Umuarama". */
export function rotuloTempo({ minutos, modo, destinoRotulo }: { minutos: number; modo: ModoRota; destinoRotulo?: string }): string {
  const m = minutosArredondados(minutos);
  const tempo = m == null ? "menos de 5 min" : `~${m} min`;
  return `${tempo} ${MODO_NA_FRASE[modo]}${destinoRotulo ? ` até ${destinoRotulo}` : ""}`;
}

/** "≈ 3,2 km em linha reta"; abaixo de 1 km, "≈ 800 m em linha reta". */
export function rotuloReta(metros: number, destinoRotulo?: string): string {
  const dist =
    metros < 1000
      ? `${Math.max(100, Math.round(metros / 100) * 100)} m`
      : `${(Math.round(metros / 100) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  return `≈ ${dist} em linha reta${destinoRotulo ? ` até ${destinoRotulo}` : ""}`;
}

/** Faixas de minutos da ordem com destino (33 + 37): ≤10, ≤20, ≤30, >30; sem tempo, por último. */
export function faixaMinutos(minutos: number | null | undefined): number {
  if (minutos == null || !Number.isFinite(minutos)) return 4;
  return minutos <= 10 ? 0 : minutos <= 20 ? 1 : minutos <= 30 ? 2 : 3;
}

/** O filtro "até N min" compara com o tempo arredondado que a pessoa vê. */
export function dentroDoTempo(minutos: number, ate: number): boolean {
  return (minutosArredondados(minutos) ?? 0) <= ate;
}

export interface Ponto {
  lat: number;
  lng: number;
}

/** Distância em metros (haversine). */
export function metrosEntre(a: Ponto, b: Ponto): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Os N mais próximos em linha reta: só eles vão à Matrix. */
export function escolherCandidatos<T extends Ponto>(itens: T[], destino: Ponto, n = CANDIDATOS_POR_ENDERECO): T[] {
  return itens
    .map((i) => ({ i, d: metrosEntre(i, destino) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(({ i }) => i);
}

/** Lotes de origens que, somadas ao destino, cabem numa chamada. */
export function emLotes<T>(itens: T[], porChamada = COORDENADAS_POR_CHAMADA): T[][] {
  const tamanho = Math.max(1, porChamada - 1);
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho));
  return out;
}

/** Chave do cache: destino cadastrado pelo id; endereço digitado pelo ponto arredondado a 3 casas. */
export function chaveDestino(d: { destinoId: string } | Ponto): string {
  return "destinoId" in d ? `d:${d.destinoId}` : `p:${d.lat.toFixed(3)},${d.lng.toFixed(3)}`;
}

/** O ponto na URL tem no máximo 2 casas (~1 km): o endereço digitado não vai inteiro para o link. */
export function pontoParaUrl(p: Ponto): { dlat: string; dlng: string } {
  return { dlat: p.lat.toFixed(2), dlng: p.lng.toFixed(2) };
}

export function pontoDaUrl(dlat: string | null | undefined, dlng: string | null | undefined): Ponto | null {
  const lat = Number(dlat);
  const lng = Number(dlng);
  if (!dlat || !dlng || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}

/** Rótulo do endereço digitado sem número de casa nem CEP: "Av. Pará, Umuarama, Uberlândia". */
export function rotuloLimpo(texto: string): string {
  const partes = texto
    .replace(/\b\d{5}-?\d{3}\b/g, "")
    .split(",")
    .map((p) =>
      p
        .replace(/\b(n[ºo°.]?|número)\s*\d+\w*/gi, "")
        .replace(/(^|\s)\d+[\w/-]*/g, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/^[\s–-]+|[\s–-]+$/g, ""),
    )
    .filter((p) => p && !/^(brasil|brazil)$/i.test(p) && /[a-zà-ú]/i.test(p));
  return partes.slice(0, 3).join(", ").slice(0, 80);
}

/**
 * Há provedor para o meio, dado o ambiente? Sem token (ou com o ônibus desligado), não: quem chama cai para a linha
 * reta. No laboratório, só com o rotas-falso (LAB_ROTAS_URL).
 */
export function provedorNoAmbiente(env: Record<string, string | undefined>, modo: ModoRota, simulado: boolean): boolean {
  const onibus = env.ROTAS_ONIBUS_ATIVO === "on";
  if (simulado) return Boolean(env.LAB_ROTAS_URL) && (modo !== "onibus" || onibus);
  if (modo === "onibus") return onibus && Boolean(env.GOOGLE_ROUTES_API_KEY);
  return Boolean(env.MAPBOX_SERVER_TOKEN || env.NEXT_PUBLIC_MAPBOX_TOKEN);
}
