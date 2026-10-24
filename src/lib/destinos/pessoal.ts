/*
  DESTINO-PESSOAL-B — o "Outro local" de cada pessoa (PURO e testável).
  • Âncoras oficiais (destinos) ficam como estão; o local pessoal é da pessoa: logada, fica em destinos_pessoais (RLS
    só dela; nem o admin lê o endereço); sem login, só na URL.
  • O admin vê só o AGREGADO: pontos de uma grade de ~300 m com 5 pessoas distintas ou mais nos últimos 90 dias, sem
    endereço e sem nome — para decidir se promove o ponto a âncora (cadastro de destinos de sempre).
  • Tempo: o motor do Prompt 37 com provedor de rotas; sem ele, a distância em linha reta dita como tal (nunca minutos
    inventados) — mesma regra de /api/tempos.
*/
import { rotuloLimpo, type Ponto } from "../rotas/tempo.ts";

/** Grade do agregado: ~300 m (0,0027° de latitude; 0,0029° de longitude perto de Uberlândia, cos 19° ≈ 0,946). */
export const CELULA_GRAUS_LAT = 0.0027;
export const CELULA_GRAUS_LNG = 0.0029;
/** Ponto só aparece ao admin com pelo menos 5 pessoas distintas nos últimos 90 dias. */
export const MIN_PESSOAS_AGREGADO = 5;
export const JANELA_AGREGADO_DIAS = 90;
/** Locais guardados por pessoa (o mais antigo sai quando passa disso). */
export const MAX_DESTINOS_PESSOAIS = 10;
export const MSG_NAO_ACHAMOS = "Não achamos este endereço.";
export const ROTULO_NAO_ACHEI = "Não achei meu local";

/** Ponto guardado com 3 casas (~110 m): o bastante para o tempo e para a grade, sem o número exato da porta. */
export function pontoGuardado(p: Ponto): Ponto {
  return { lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 };
}

export function pontoValido(p: { lat?: unknown; lng?: unknown }): p is Ponto {
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -34 && lat <= 6 && lng >= -75 && lng <= -28;
}

export function celulaDoPonto(p: Ponto): { i: number; j: number; chave: string } {
  const i = Math.floor(p.lat / CELULA_GRAUS_LAT);
  const j = Math.floor(p.lng / CELULA_GRAUS_LNG);
  return { i, j, chave: `${i}:${j}` };
}

/** Centro da célula (o que o admin vê e o que vai para "Promover a âncora"): nunca o ponto de uma pessoa. */
export function centroDaCelula(i: number, j: number): Ponto {
  return { lat: Math.round((i + 0.5) * CELULA_GRAUS_LAT * 100000) / 100000, lng: Math.round((j + 0.5) * CELULA_GRAUS_LNG * 100000) / 100000 };
}

export interface CelulaAgregada {
  chave: string;
  centro: Ponto;
  pessoas: number;
}

/**
 * A mesma regra da função do banco (destinos_pessoais_agregado), para teste: pessoas DISTINTAS por célula, só uso nos
 * últimos 90 dias, só células com 5 ou mais. Mais pessoas primeiro.
 */
export function agregarCelulas(
  linhas: readonly { userId: string; lat: number; lng: number; usadoEm: string }[],
  agora: Date,
  min = MIN_PESSOAS_AGREGADO,
  dias = JANELA_AGREGADO_DIAS,
): CelulaAgregada[] {
  const desde = agora.getTime() - dias * 86_400_000;
  const porCelula = new Map<string, { i: number; j: number; pessoas: Set<string> }>();
  for (const l of linhas) {
    if (Date.parse(l.usadoEm) < desde) continue;
    const c = celulaDoPonto(l);
    const g = porCelula.get(c.chave) ?? { i: c.i, j: c.j, pessoas: new Set<string>() };
    g.pessoas.add(l.userId);
    porCelula.set(c.chave, g);
  }
  return [...porCelula.entries()]
    .filter(([, g]) => g.pessoas.size >= min)
    .map(([chave, g]) => ({ chave, centro: centroDaCelula(g.i, g.j), pessoas: g.pessoas.size }))
    .sort((a, b) => b.pessoas - a.pessoas || a.chave.localeCompare(b.chave));
}

/** Rótulo guardado do local: sem número de casa nem CEP (mesma limpeza da URL). */
export function rotuloDoLocal(texto: string): string {
  return rotuloLimpo(String(texto ?? "")) || "Meu local";
}

/** Texto que vai à busca de endereço: o digitado (sem < >), com a cidade e o estado para não achar homônimo longe. */
export function consultaDoLocal(texto: string, cidade: string, uf: string): { endereco: string; cidade: string; uf: string } | null {
  const limpa = (s: unknown, max: number) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  const endereco = limpa(texto, 150);
  if (endereco.length < 3) return null;
  return { endereco, cidade: limpa(cidade, 80), uf: limpa(uf, 2).toUpperCase() };
}

export type PedidoNaoAchei = { ok: true; nome: string; cidade: string } | { ok: false; erro: string };

/** "Não achei meu local": nome do lugar + cidade. Sem endereço, sem contato. */
export function validarNaoAchei(e: { nome?: unknown; cidade?: unknown }): PedidoNaoAchei {
  const limpa = (s: unknown) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  const nome = limpa(e.nome);
  const cidade = limpa(e.cidade);
  if (nome.length < 2 || nome.length > 80) return { ok: false, erro: "Diga o nome do lugar (ex.: Hospital Santa Clara)." };
  if (cidade.length < 2 || cidade.length > 80) return { ok: false, erro: "Diga a cidade do lugar." };
  if (/@|https?:\/\/|\d{4,}/.test(nome)) return { ok: false, erro: "Só o nome do lugar, sem contato nem endereço." };
  return { ok: true, nome, cidade };
}

/**
 * Laboratório (INTEGRACOES_SIMULADAS=on): nada sai para a rede. Endereço com "inexistente" não é achado (cai no
 * "Não achei meu local"); qualquer outro vira um ponto fixo perto do centro de Uberlândia, deslocado pelo texto
 * (pontos diferentes para textos diferentes, o mesmo para o mesmo texto).
 */
export function pontoDoLaboratorio(texto: string): Ponto | null {
  if (/inexistente/i.test(texto)) return null;
  let h = 0;
  for (const ch of texto.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 1000;
  return { lat: -18.9113 + (h % 20) / 1000, lng: -48.2622 + Math.floor(h / 50) / 1000 };
}
