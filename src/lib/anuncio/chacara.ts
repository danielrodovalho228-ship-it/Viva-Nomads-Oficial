/*
  TIPO-CHACARA-B — o tipo "Chácara/Sítio" (decisão do Daniel, 24/10: só chácara/sítio; fazenda e rancho ficam fora até o
  parecer jurídico). PURO e testável.
  • Campos só deste tipo, obrigatórios para publicar: acesso, tipo de internet e o ponto no mapa marcado pelo dono
    (endereço rural geocodifica com erro). A velocidade continua sendo o item "internet informada" do Essencial.
  • A distância até a cidade (e até os destinos, pelo motor do Prompt 37) é CALCULADA do ponto marcado, nunca digitada.
  • Níveis, mínimos, taxa e contrato não mudam. Andar e elevador não aparecem para este tipo (como para casa).
  • Fica em detalhes_anuncio.chacara (0235): {acesso, internet, pontoMarcado, distanciaCidadeKm?}. O ponto em si vai
    para lat/lng → lat_exata/lng_exata (privado; o público é o aproximado da 0066).
*/
import { distanciaKm } from "../bairros.ts";

export const TIPO_CHACARA = "chacara";
export const ROTULO_CHACARA = "Chácara/Sítio";

export const ACESSOS_CHACARA = [
  { valor: "asfalto", rotulo: "Asfalto" },
  { valor: "terra", rotulo: "Estrada de terra" },
  { valor: "misto", rotulo: "Parte asfalto, parte terra" },
] as const;
export const INTERNETS_CHACARA = [
  { valor: "fibra", rotulo: "Fibra" },
  { valor: "radio", rotulo: "Rádio" },
  { valor: "satelite", rotulo: "Satélite" },
  { valor: "movel", rotulo: "Internet móvel (4G/5G)" },
  // E102-B: resposta válida (salva o rascunho), mas não publica — temInternet (internet-imovel.ts) decide.
  { valor: "nao_tem", rotulo: "Não tem internet" },
] as const;
export type AcessoChacara = (typeof ACESSOS_CHACARA)[number]["valor"];
export type InternetChacara = (typeof INTERNETS_CHACARA)[number]["valor"];

/** Linha fixa do cadastro deste tipo. */
export const LINHA_FIXA_CHACARA = "Anuncie só a casa para morar. Uso da terra para plantio ou criação não entra no anúncio.";
export const ROTULO_FALTA_CHACARA = "Dados da chácara/sítio";

export interface DadosChacara {
  acesso?: AcessoChacara;
  internet?: InternetChacara;
  /** O dono marcou o ponto no mapa (o ponto fica nas colunas privadas). */
  pontoMarcado?: boolean;
  /** Calculada no servidor a partir do ponto marcado (linha reta até o centro da cidade). Nunca vem do formulário. */
  distanciaCidadeKm?: number;
}

export const ehChacara = (tipo: string | null | undefined): boolean => (tipo ?? "").toLowerCase() === TIPO_CHACARA;
/** Tipos sem andar nem elevador na exibição (regra de casa): casa e chácara/sítio. */
export const tipoSemAndar = (tipo: string | null | undefined): boolean => ["casa", TIPO_CHACARA].includes((tipo ?? "").toLowerCase());

const ehAcesso = (v: unknown): v is AcessoChacara => ACESSOS_CHACARA.some((a) => a.valor === v);
const ehInternet = (v: unknown): v is InternetChacara => INTERNETS_CHACARA.some((a) => a.valor === v);

/** Lê o grupo gravado (ou vindo do banco). Campo torto cai fora; grupo vazio = undefined. */
export function normalizarChacara(raw: unknown): DadosChacara | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const out: DadosChacara = {};
  if (ehAcesso(r.acesso)) out.acesso = r.acesso;
  if (ehInternet(r.internet)) out.internet = r.internet;
  if (r.pontoMarcado === true) out.pontoMarcado = true;
  const km = typeof r.distanciaCidadeKm === "number" ? r.distanciaCidadeKm : NaN;
  if (Number.isFinite(km) && km >= 0 && km <= 500) out.distanciaCidadeKm = Math.round(km * 10) / 10;
  return Object.keys(out).length ? out : undefined;
}

export interface PontoMarcado {
  lat: number;
  lng: number;
}
export const pontoMarcadoValido = (p: unknown): p is PontoMarcado => {
  const o = p as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(o?.lat);
  const lng = Number(o?.lng);
  return !!o && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -34 && lat <= 6 && lng >= -75 && lng <= -28;
};

/**
 * O que o servidor grava a partir do formulário: só acesso e internet válidos e o ponto (se veio, vale como marcado).
 * A distância NÃO vem do formulário — o servidor calcula do ponto (distanciaCidade) e põe depois.
 */
export function chacaraDoFormulario(e: { acesso?: unknown; internet?: unknown; ponto?: unknown }, anterior?: DadosChacara): { dados: DadosChacara; ponto: PontoMarcado | null } {
  const ponto = pontoMarcadoValido(e.ponto) ? { lat: Number((e.ponto as PontoMarcado).lat), lng: Number((e.ponto as PontoMarcado).lng) } : null;
  const dados: DadosChacara = {
    ...(ehAcesso(e.acesso) ? { acesso: e.acesso } : {}),
    ...(ehInternet(e.internet) ? { internet: e.internet } : {}),
    // Sem ponto novo, o marcado antes continua valendo (editar acesso não apaga o ponto).
    ...(ponto || anterior?.pontoMarcado ? { pontoMarcado: true } : {}),
    ...(!ponto && anterior?.distanciaCidadeKm !== undefined ? { distanciaCidadeKm: anterior.distanciaCidadeKm } : {}),
  };
  return { dados, ponto };
}

/** O que falta para publicar este tipo (vazio = pode). */
export function faltaChacara(d: DadosChacara | undefined): string[] {
  const falta: string[] = [];
  if (!d?.acesso) falta.push("acesso");
  if (!d?.internet) falta.push("tipo de internet");
  if (!d?.pontoMarcado) falta.push("ponto no mapa");
  return falta;
}

/**
 * E102-A: as linhas do bloco "Dados da chácara/sítio" na Revisão (Passo 10) — o que foi PREENCHIDO, não só o que falta:
 * "Acesso: Asfalto", "Internet: Fibra" e "Ponto marcado no mapa" com o sinal de feito (ou "Falta marcar o ponto"). O
 * sinal é um ícone na tela, não um caractere (a guarda de emoji da interface vale para "✓").
 */
export function linhasChacaraRevisao(d: DadosChacara | undefined): { chave: "acesso" | "internet" | "ponto"; texto: string; ok: boolean }[] {
  const acesso = ACESSOS_CHACARA.find((a) => a.valor === d?.acesso)?.rotulo;
  const internet = INTERNETS_CHACARA.find((a) => a.valor === d?.internet)?.rotulo;
  return [
    { chave: "acesso", texto: acesso ? `Acesso: ${acesso}` : "Acesso: falta informar", ok: !!acesso },
    { chave: "internet", texto: internet ? `Internet: ${internet}` : "Internet: falta informar", ok: !!internet },
    { chave: "ponto", texto: d?.pontoMarcado ? "Ponto marcado no mapa" : "Falta marcar o ponto", ok: !!d?.pontoMarcado },
  ];
}

/** Distância em linha reta do ponto marcado até o centro da cidade (km, 1 casa). */
export function distanciaCidade(ponto: PontoMarcado, centroCidade: PontoMarcado): number {
  return Math.round(distanciaKm(ponto, centroCidade) * 10) / 10;
}

const kmFalado = (km: number) => (km < 1 ? "menos de 1 km" : `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`);

/** Linha do anúncio: "Acesso por estrada de terra · internet por rádio · ~12,4 km do centro de Uberlândia em linha reta". */
export function linhaChacara(d: DadosChacara | undefined, cidade?: string | null): string | null {
  if (!d) return null;
  const partes: string[] = [];
  const acesso = ACESSOS_CHACARA.find((a) => a.valor === d.acesso)?.rotulo;
  if (acesso) partes.push(`Acesso: ${acesso.toLowerCase()}`);
  const internet = INTERNETS_CHACARA.find((a) => a.valor === d.internet)?.rotulo;
  if (d.internet === "nao_tem") partes.push("sem internet");
  else if (internet) partes.push(`internet: ${internet === "Internet móvel (4G/5G)" ? "móvel (4G/5G)" : internet.toLowerCase()}`);
  if (d.distanciaCidadeKm !== undefined && cidade) partes.push(`~${kmFalado(d.distanciaCidadeKm)} do centro de ${cidade} em linha reta`);
  if (!partes.length) return null;
  const t = partes.join(" · ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Centro das cidades conhecidas (o resto o servidor pede ao OSM pelo nome da cidade). */
export const CENTROS_CONHECIDOS: Readonly<Record<string, PontoMarcado>> = {
  "uberlandia|MG": { lat: -18.9113, lng: -48.2622 },
};
