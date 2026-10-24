/*
  Prompt 54 — painel de desempenho do anúncio (roteiro D1). PURO (node --test src/lib/anuncio/desempenho.test.ts).

  Por anúncio, últimos 30 dias contra os 30 anteriores: visualizações, favoritos, candidaturas, taxa de resposta e
  conversão. Cada número leva a FÓRMULA escrita. Fora da conta: o próprio dono vendo o anúncio e contas de teste.
  Comparação só com ≥ 5 imóveis parecidos (mesma cidade, mesmo bairro ou até 2 km, mesmo nº de quartos): mediana do
  grupo. Nenhum número de ganho estimado — só o que aconteceu e o que falta fazer.
*/

import { PESOS, type Motivo } from "../ranking/ordem.ts";

export const DIAS_PERIODO = 30;
export const MIN_PARECIDOS = 5;
export const RAIO_PARECIDOS_KM = 2;
export const TEXTO_SEM_COMPARACAO = "Ainda não há imóveis parecidos suficientes para comparar.";

export type TipoEvento = "ver_anuncio" | "favoritar" | "enviar_candidatura";
export interface Evento {
  tipo: string;
  criado_em: string;
  usuario_id: string | null;
}

export interface Contagem {
  visualizacoes: number;
  favoritos: number;
  candidaturas: number;
}

export const FORMULAS = {
  visualizacoes: "Aberturas da página do anúncio nos últimos 30 dias (sem as suas e sem contas de teste).",
  favoritos: "Vezes que alguém salvou o anúncio nos favoritos nos últimos 30 dias.",
  candidaturas: "Candidaturas enviadas para este anúncio nos últimos 30 dias.",
  resposta: "Conversas respondidas ÷ conversas recebidas (as mesmas do selo \"Responde rápido\").",
  conversao: "Candidaturas ÷ visualizações nos últimos 30 dias.",
  mediana: "Mediana dos imóveis parecidos: mesma cidade, mesmo bairro ou até 2 km, mesmo número de quartos (mínimo 5).",
} as const;

const DIA = 86_400_000;

/** Janela [de, ate) dos últimos N dias e a anterior. */
export function janelas(agora: Date, dias = DIAS_PERIODO): { atual: [number, number]; anterior: [number, number] } {
  const ate = agora.getTime();
  return { atual: [ate - dias * DIA, ate], anterior: [ate - 2 * dias * DIA, ate - dias * DIA] };
}

/** Conta os eventos de uma janela, sem o dono e sem contas de teste (sessões anônimas contam). */
export function contar(eventos: readonly Evento[], janela: [number, number], fora: { donoId: string; contasTeste: ReadonlySet<string> }): Contagem {
  const c: Contagem = { visualizacoes: 0, favoritos: 0, candidaturas: 0 };
  for (const e of eventos) {
    const t = Date.parse(e.criado_em);
    if (!(t >= janela[0] && t < janela[1])) continue;
    if (e.usuario_id && (e.usuario_id === fora.donoId || fora.contasTeste.has(e.usuario_id))) continue;
    if (e.tipo === "ver_anuncio") c.visualizacoes++;
    else if (e.tipo === "favoritar") c.favoritos++;
    else if (e.tipo === "enviar_candidatura") c.candidaturas++;
  }
  return c;
}

/** Conversão em % (1 casa) — null sem visualização (não dá para dividir). */
export function conversao(c: Contagem): number | null {
  return c.visualizacoes > 0 ? Math.round((c.candidaturas / c.visualizacoes) * 1000) / 10 : null;
}

/** Taxa de resposta em % — null com menos de MIN conversas (o mesmo critério do selo). */
export function taxaResposta(conversas: number, respondidas: number, minimo = 3): number | null {
  return conversas >= minimo ? Math.round((respondidas / conversas) * 100) : null;
}

/** Mediana — null com menos de MIN_PARECIDOS valores (não compara grupo pequeno). */
export function medianaDoGrupo(valores: readonly number[]): number | null {
  if (valores.length < MIN_PARECIDOS) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round(((v[m - 1] + v[m]) / 2) * 10) / 10;
}

export interface ImovelComparavel {
  id: string;
  cidade: string | null;
  bairro: string | null;
  quartos: number;
  lat: number | null;
  lng: number | null;
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** Os parecidos: mesma cidade e mesmo nº de quartos, e (mesmo bairro OU até 2 km). Nunca o próprio. */
export function parecidos<T extends ImovelComparavel>(alvo: ImovelComparavel, outros: readonly T[]): T[] {
  return outros.filter((o) => {
    if (o.id === alvo.id || norm(o.cidade) !== norm(alvo.cidade) || !norm(alvo.cidade) || o.quartos !== alvo.quartos) return false;
    if (norm(alvo.bairro) && norm(o.bairro) === norm(alvo.bairro)) return true;
    return alvo.lat != null && alvo.lng != null && o.lat != null && o.lng != null && km({ lat: alvo.lat, lng: alvo.lng }, { lat: o.lat, lng: o.lng }) <= RAIO_PARECIDOS_KM;
  });
}

export interface Metrica {
  chave: "visualizacoes" | "favoritos" | "candidaturas" | "resposta" | "conversao";
  rotulo: string;
  valor: number | null;
  anterior: number | null;
  unidade: "" | "%";
  formula: string;
  /** Mediana dos parecidos (null = sem comparação, com TEXTO_SEM_COMPARACAO). */
  mediana: number | null;
}

/** As 5 métricas do painel, com fórmula e comparação. */
export function metricas(e: {
  atual: Contagem;
  anterior: Contagem;
  resposta: number | null;
  medianas: Partial<Record<Metrica["chave"], number | null>>;
}): Metrica[] {
  const m = (chave: Metrica["chave"], rotulo: string, valor: number | null, anterior: number | null, unidade: "" | "%"): Metrica => ({
    chave,
    rotulo,
    valor,
    anterior,
    unidade,
    formula: FORMULAS[chave],
    mediana: e.medianas[chave] ?? null,
  });
  return [
    m("visualizacoes", "Visualizações", e.atual.visualizacoes, e.anterior.visualizacoes, ""),
    m("favoritos", "Favoritos", e.atual.favoritos, e.anterior.favoritos, ""),
    m("candidaturas", "Candidaturas", e.atual.candidaturas, e.anterior.candidaturas, ""),
    m("resposta", "Taxa de resposta", e.resposta, null, "%"),
    m("conversao", "Conversão", conversao(e.atual), conversao(e.anterior), "%"),
  ];
}

/** "↑ 12 em relação aos 30 dias anteriores" — só o que aconteceu, sem projeção. */
export function textoVariacao(atual: number | null, anterior: number | null, unidade: "" | "%"): string | null {
  if (atual == null || anterior == null) return null;
  const d = Math.round((atual - anterior) * 10) / 10;
  if (d === 0) return "Igual aos 30 dias anteriores.";
  const fmt = `${Math.abs(d).toLocaleString("pt-BR")}${unidade === "%" ? " p.p." : ""}`;
  return `${d > 0 ? "↑" : "↓"} ${fmt} em relação aos 30 dias anteriores.`;
}

// ── Linha do tempo: o que mudou e quando (marcas), ao lado das visualizações por semana ──────────────────────────

export interface Marca {
  em: string; // ISO
  texto: string; // "Anúncio publicado", "Internet medida", "Nível: Conforto"
}

export interface SemanaLinha {
  inicio: string; // AAAA-MM-DD
  visualizacoes: number;
  marcas: string[];
}

/** Últimas N semanas (da mais antiga à mais recente): visualizações (sem dono e sem teste) e as marcas da semana. */
export function linhaDoTempo(
  eventos: readonly Evento[],
  marcas: readonly Marca[],
  agora: Date,
  fora: { donoId: string; contasTeste: ReadonlySet<string> },
  semanas = 8,
): SemanaLinha[] {
  const fim = agora.getTime();
  const out: SemanaLinha[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const de = fim - (i + 1) * 7 * DIA;
    const ate = fim - i * 7 * DIA;
    const v = contar(eventos, [de, ate], fora).visualizacoes;
    const ms = marcas.filter((m) => {
      const t = Date.parse(m.em);
      return t >= de && t < ate;
    });
    out.push({ inicio: new Date(de - 3 * 3_600_000).toISOString().slice(0, 10), visualizacoes: v, marcas: ms.map((m) => m.texto) });
  }
  return out;
}

// ── Ação ao lado do número: o que falta na nota de qualidade (Prompt 33), com os pontos da NOTA (não de visualização) ──

/** O máximo de cada motivo da nota; o que falta é máximo − pontos atuais. */
const MAXIMO_DO_MOTIVO: Record<string, number> = {
  comodos: PESOS.comodos,
  fotos_parceiro: PESOS.fotosParceiro,
  descricao: PESOS.descricao,
  regras: PESOS.regras,
  endereco: PESOS.endereco,
  calendario: PESOS.calendario14,
  calendario_velho: PESOS.calendario14,
  identidade: PESOS.identidade,
  matricula: PESOS.matricula,
  resposta: PESOS.resposta,
  preco_justo: PESOS.precoJusto,
  home_office: PESOS.homeOfficeMedido,
  considerar_antes: PESOS.considerarAntes,
};

const ACAO_DO_MOTIVO: Record<string, string> = {
  comodos: "Fotografe mais cômodos diferentes",
  fotos_parceiro: "Fotos feitas por fotógrafo parceiro",
  descricao: "Complete a descrição (60+ palavras)",
  regras: "Complete as regras da casa",
  endereco: "Cadastre o endereço exato",
  calendario: "Confirme o calendário",
  calendario_velho: "Confirme o calendário",
  identidade: "Confirme a sua identidade",
  matricula: "Envie a matrícula do imóvel para conferência",
  resposta: "Responda as conversas",
  preco_justo: "Informe o valor de estadias curtas (selo Preço justo)",
  home_office: "Meça a internet no imóvel",
  considerar_antes: "Escreva o que considerar antes de pedir",
};

export interface AcaoDaNota {
  codigo: string;
  texto: string;
  /** Pontos que a NOTA de qualidade ganha ao resolver (fórmula da nota, não estimativa de visitas). */
  pontos: number;
}

/** "Fotografe mais cômodos diferentes: +4 na nota" — do que mais pesa ao que menos pesa. */
export function acoesDaNota(motivos: readonly Motivo[]): AcaoDaNota[] {
  const out: AcaoDaNota[] = [];
  for (const m of motivos) {
    const max = MAXIMO_DO_MOTIVO[m.codigo];
    const acao = ACAO_DO_MOTIVO[m.codigo];
    if (max == null || !acao) continue;
    const falta = Math.round((max - Math.max(0, m.pontos)) * 10) / 10;
    if (falta > 0) out.push({ codigo: m.codigo, texto: acao, pontos: falta });
  }
  return out.sort((a, b) => b.pontos - a.pontos);
}

/** Palavras que nunca podem aparecer no painel (nada de ganho estimado). */
export const SEM_ESTIMATIVA = /(ganho estimado|ganhar|vai render|aumenta (suas|as) (visualiza|chances|candidat)|\+\d+ ?%? ?(de )?(visualiza|candidat|reserva))/i;
