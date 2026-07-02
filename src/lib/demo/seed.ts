/**
 * SEED do modo demonstração — dados FICTÍCIOS, em memória, para apresentações.
 *
 * Nada aqui toca o banco. Todos os registros têm `_demo: true` e representam o
 * cenário de um proprietário/gestor ativo: 8 imóveis, 3 contratos (1 vencendo
 * em ~12 dias), 12 leads no funil, chamados de manutenção e agregados coerentes.
 *
 * Os tipos são os MESMOS das telas reais (Property, Lead, PortfolioUnit, …) —
 * a UI não muda, só a fonte dos dados (ver lib/demo/demo-mode.tsx).
 */

import type { Property } from "@/lib/types";
import type { Lead } from "@/lib/data/lead-types";
import type { PortfolioUnit } from "@/lib/portfolio";
// Só o TIPO de messages.ts (o módulo importa o cliente de servidor — não pode
// entrar no bundle do navegador). As conversas demo são definidas aqui.
import type { Conversation } from "@/lib/data/messages";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { SAMPLE_LEADS } from "@/lib/data/lead-types";
export { SAMPLE_ORDERS as DEMO_ORDERS } from "@/lib/service-orders";

/** Conversas fictícias (mesmo tipo da tela de mensagens). */
export const DEMO_CONVERSATIONS: (Conversation & { _demo: true })[] = [
  {
    _demo: true,
    id: "demo-c1",
    name: "Ana C.",
    property: "Apto Santa Mônica",
    preview: "Perfeito! Posso fazer a visita virtual amanhã às 19h?",
    messages: [
      { id: "m1", from: "them", text: "Olá! Tenho interesse no apartamento para 3 meses, a partir do dia 15." },
      { id: "m2", from: "me", text: "Olá, Ana! Fica ótimo. Quer fazer uma visita virtual antes?" },
      { id: "m3", from: "them", text: "Perfeito! Posso fazer a visita virtual amanhã às 19h?" },
    ],
  },
  {
    _demo: true,
    id: "demo-c2",
    name: "Bruno T.",
    property: "Casa no Brasil",
    preview: "Fechado. Enviei os documentos pela plataforma.",
    messages: [
      { id: "m1", from: "them", text: "Boa tarde! O contrato de 6 meses pode começar em 01/08?" },
      { id: "m2", from: "me", text: "Pode sim, Bruno. Envie seus documentos pela plataforma para adiantarmos." },
      { id: "m3", from: "them", text: "Fechado. Enviei os documentos pela plataforma." },
    ],
  },
  {
    _demo: true,
    id: "demo-c3",
    name: "Carla M.",
    property: "Studio Granja Marileusa",
    preview: "O studio tem mesa boa para trabalhar? Sou designer.",
    messages: [
      { id: "m1", from: "them", text: "Oi! O studio tem mesa boa para trabalhar? Sou designer." },
    ],
  },
];

/** Marca de dado fictício (para depuração e selos "exemplo"). */
export const DEMO_FLAG = { _demo: true as const, rotulo: "exemplo · fictício" };

// ── 8 imóveis (5 alugados, 2 vagos/pausados, 1 em análise) ──────────────────
// Clona os imóveis de exemplo já validados e varia bairro/preço/status/faixa.

function cloneProp(
  base: Property,
  over: Partial<Property> & { id: string }
): Property & { _demo: true } {
  return { ...base, ...over, _demo: true } as Property & { _demo: true };
}

const [P1, P2, P3] = SAMPLE_PROPERTIES;

export const DEMO_PROPERTIES: (Property & { _demo: true })[] = [
  cloneProp(P1, { id: "demo-001", status: "active" }), // alugado
  cloneProp(P2, { id: "demo-002", status: "active" }), // alugado
  cloneProp(P3, { id: "demo-003", status: "active" }), // alugado
  cloneProp(P1, {
    id: "demo-004",
    title: "Apartamento 1 quarto no Fundinho, charme histórico",
    neighborhood: "Fundinho",
    bedrooms: 1,
    bathrooms: 1,
    areaM2: 52,
    monthlyPrice: 2600,
    rating: 4.6,
    reviewCount: 7,
    status: "active", // alugado
    faixasAceitas: ["media_estadia", "longa"],
  }),
  cloneProp(P2, {
    id: "demo-005",
    title: "Casa compacta com quintal no Brasil",
    neighborhood: "Brasil",
    bedrooms: 3,
    bathrooms: 2,
    areaM2: 110,
    monthlyPrice: 4100,
    rating: 4.9,
    reviewCount: 15,
    status: "active", // alugado
    faixasAceitas: ["temporada", "media_estadia", "longa"],
  }),
  cloneProp(P3, {
    id: "demo-006",
    title: "Studio novo no Granja Marileusa",
    neighborhood: "Granja Marileusa",
    bedrooms: 1,
    bathrooms: 1,
    areaM2: 38,
    monthlyPrice: 2900,
    rating: 0,
    reviewCount: 0,
    status: "paused", // vago
    faixasAceitas: ["temporada", "media_estadia"],
  }),
  cloneProp(P1, {
    id: "demo-007",
    title: "Apartamento 2 quartos no Saraiva",
    neighborhood: "Saraiva",
    bedrooms: 2,
    bathrooms: 1,
    areaM2: 64,
    monthlyPrice: 2750,
    rating: 4.4,
    reviewCount: 5,
    status: "paused", // vago
    faixasAceitas: ["media_estadia"],
  }),
  cloneProp(P2, {
    id: "demo-008",
    title: "Cobertura compacta no Tabajaras",
    neighborhood: "Tabajaras",
    bedrooms: 2,
    bathrooms: 2,
    areaM2: 88,
    monthlyPrice: 4800,
    rating: 0,
    reviewCount: 0,
    status: "draft", // em análise
    faixasAceitas: ["longa"],
  }),
];

/** Leads e visualizações por imóvel (para listas/atividade). */
export const DEMO_PROPERTY_STATS: Record<string, { leads: number; views: number }> = {
  "demo-001": { leads: 3, views: 412 },
  "demo-002": { leads: 2, views: 265 },
  "demo-003": { leads: 2, views: 198 },
  "demo-004": { leads: 1, views: 154 },
  "demo-005": { leads: 2, views: 240 },
  "demo-006": { leads: 1, views: 96 },
  "demo-007": { leads: 1, views: 61 },
  "demo-008": { leads: 0, views: 12 },
};

// ── 12 leads num funil (Novo → … → Ganho/Perdido) ───────────────────────────
// A tela de leads usa o tipo Lead (semáforo/verificação); o estágio do funil e
// a origem ficam em DEMO_LEAD_FUNNEL, usados onde a UI exibir.

export type DemoLeadStage =
  | "novo"
  | "contatado"
  | "visita"
  | "proposta"
  | "fechamento"
  | "ganho"
  | "perdido";

function lead(
  id: string,
  name: string,
  property: string,
  category: string,
  light: Lead["light"],
  extra: Partial<Lead> = {}
): Lead & { _demo: true } {
  return {
    id,
    name,
    property,
    category,
    riskCategories: light === "green" ? ["Identidade OK", "Sem ações relevantes"] : ["Verificação parcial"],
    light,
    verified: light === "green",
    desiredPeriodDays: 90,
    budgetMatch: true,
    phone: `(34) 99999-0${id.padStart(3, "0")}`,
    email: `${name.split(" ")[0].toLowerCase()}@exemplo.com`,
    ...extra,
    _demo: true,
  } as Lead & { _demo: true };
}

export const DEMO_LEADS: (Lead & { _demo: true })[] = [
  ...SAMPLE_LEADS.map((l) => ({ ...l, _demo: true as const })),
  lead("4", "Otávio B.", "Apto Santa Mônica", "Analista · realocação", "green", { desiredPeriodDays: 60 }),
  lead("5", "Bruno T.", "Casa no Brasil", "Engenheiro · projeto de 6 meses", "green", { desiredPeriodDays: 180 }),
  lead("6", "Carla M.", "Studio Granja Marileusa", "Designer · nômade digital", "green", { desiredPeriodDays: 60 }),
  lead("7", "Diego F.", "Apto Fundinho", "Médico residente", "yellow", { desiredPeriodDays: 120, budgetMatch: false }),
  lead("8", "Elisa R.", "Apto Santa Mônica", "Consultora · alocação", "green", { desiredPeriodDays: 90 }),
  lead("9", "Fábio N.", "Cobertura Tabajaras", "Executivo em transferência", "green", { desiredPeriodDays: 365 }),
  lead("10", "Gabriela S.", "Apto Saraiva", "Professora visitante", "yellow", { desiredPeriodDays: 150 }),
  lead("11", "Henrique L.", "Casa no Brasil", "TI · contrato remoto", "green", { desiredPeriodDays: 90 }),
  lead("12", "Íris P.", "Studio Granja Marileusa", "Pesquisadora · UFU", "green", { desiredPeriodDays: 120 }),
];

/** Funil + origem + última interação (dias atrás). ≥3 dias = "parado". */
export const DEMO_LEAD_FUNNEL: Record<
  string,
  { stage: DemoLeadStage; origem: string; ultimaInteracaoDias: number }
> = {
  "1": { stage: "proposta", origem: "Busca no site", ultimaInteracaoDias: 1 },
  "2": { stage: "visita", origem: "Indicação", ultimaInteracaoDias: 2 },
  "3": { stage: "contatado", origem: "Busca no site", ultimaInteracaoDias: 4 },
  "4": { stage: "novo", origem: "Instagram", ultimaInteracaoDias: 0 },
  "5": { stage: "fechamento", origem: "Busca no site", ultimaInteracaoDias: 1 },
  "6": { stage: "novo", origem: "Busca no site", ultimaInteracaoDias: 0 },
  "7": { stage: "contatado", origem: "WhatsApp", ultimaInteracaoDias: 5 },
  "8": { stage: "visita", origem: "Busca no site", ultimaInteracaoDias: 2 },
  "9": { stage: "proposta", origem: "LinkedIn", ultimaInteracaoDias: 3 },
  "10": { stage: "novo", origem: "Busca no site", ultimaInteracaoDias: 1 },
  "11": { stage: "ganho", origem: "Indicação", ultimaInteracaoDias: 6 },
  "12": { stage: "perdido", origem: "Busca no site", ultimaInteracaoDias: 8 },
};

// ── 3 contratos ativos (1 vencendo em ~12 dias) ─────────────────────────────

export interface DemoContract {
  _demo: true;
  numero: string;
  imovel: string;
  inquilino: string;
  inicio: string; // ISO
  terminaEmDias: number;
  valorMes: number;
  status: "ativo";
  garantia: string;
  caucao: number;
}

export const DEMO_CONTRACTS: DemoContract[] = [
  {
    ...DEMO_FLAG,
    numero: "VN-CT-2026-0042",
    imovel: "Apartamento no Santa Mônica",
    inquilino: "Ana C.",
    inicio: "2026-03-15",
    terminaEmDias: 12, // alimenta o alerta de vencimento
    valorMes: 3200,
    status: "ativo",
    garantia: "Caução à vista (conta vinculada)",
    caucao: 6400,
  },
  {
    ...DEMO_FLAG,
    numero: "VN-CT-2026-0057",
    imovel: "Casa no Brasil",
    inquilino: "Bruno T.",
    inicio: "2026-05-01",
    terminaEmDias: 74,
    valorMes: 4100,
    status: "ativo",
    garantia: "Seguro-fiança",
    caucao: 0,
  },
  {
    ...DEMO_FLAG,
    numero: "VN-CT-2026-0061",
    imovel: "Apto no Fundinho",
    inquilino: "Diego F.",
    inicio: "2026-06-10",
    terminaEmDias: 129,
    valorMes: 2600,
    status: "ativo",
    garantia: "Caução parcelada (conta vinculada)",
    caucao: 5200,
  },
];

// ── Carteira consolidada (Plano Gestor): 8 unidades, ocupação ~86% ──────────

export const DEMO_PORTFOLIO: (PortfolioUnit & { _demo: true })[] = [
  { _demo: true, id: "demo-001", title: "Apto Santa Mônica", neighborhood: "Santa Mônica", ownership: "own", status: "occupied", monthlyRent: 3200, tenantName: "Ana C.", contractEndsInDays: 12 },
  { _demo: true, id: "demo-002", title: "Studio no Centro", neighborhood: "Centro", ownership: "own", status: "occupied", monthlyRent: 2900, tenantName: "Marina L.", contractEndsInDays: 45 },
  { _demo: true, id: "demo-003", title: "Apto Jardim Karaíba", neighborhood: "Jardim Karaíba", ownership: "subleased", status: "occupied", monthlyRent: 3600, tenantName: "Pedro A.", contractEndsInDays: 88 },
  { _demo: true, id: "demo-004", title: "Apto Fundinho", neighborhood: "Fundinho", ownership: "own", status: "occupied", monthlyRent: 2600, tenantName: "Diego F.", contractEndsInDays: 129 },
  { _demo: true, id: "demo-005", title: "Casa no Brasil", neighborhood: "Brasil", ownership: "own", status: "occupied", monthlyRent: 4100, tenantName: "Bruno T.", contractEndsInDays: 74 },
  { _demo: true, id: "demo-006", title: "Studio Granja Marileusa", neighborhood: "Granja Marileusa", ownership: "subleased", status: "occupied", monthlyRent: 2900, tenantName: "Carla M.", contractEndsInDays: 33 },
  { _demo: true, id: "demo-007", title: "Apto Saraiva", neighborhood: "Saraiva", ownership: "own", status: "occupied", monthlyRent: 2750, tenantName: "Elisa R.", contractEndsInDays: 58 },
  { _demo: true, id: "demo-008", title: "Cobertura Tabajaras", neighborhood: "Tabajaras", ownership: "own", status: "vacant", monthlyRent: 0 },
];

// ── Agregados coerentes (KPIs da visão geral) ───────────────────────────────
// Receita = soma dos aluguéis ocupados acima; conversão = 1 ganho / 12 leads.

export const DEMO_KPIS = {
  ...DEMO_FLAG,
  receitaMes: DEMO_PORTFOLIO.reduce((s, u) => s + u.monthlyRent, 0), // R$ 22.050
  comissoesMes: 1764, // ~8% sobre fechamentos do mês
  ocupacaoPct: Math.round(
    (DEMO_PORTFOLIO.filter((u) => u.status === "occupied").length / DEMO_PORTFOLIO.length) * 100
  ), // 88% (~86%)
  ticketMedio: 3150,
  contratosAtivos: DEMO_CONTRACTS.length,
  leads: DEMO_LEADS.length,
  conversaoLeadsPct: 8, // 1 ganho em 12
  visualizacoes: Object.values(DEMO_PROPERTY_STATS).reduce((s, x) => s + x.views, 0), // 1.438
  mensagens: 5,
};
