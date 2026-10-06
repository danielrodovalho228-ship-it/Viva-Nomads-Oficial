/*
  FONTE ÚNICA DA VERDADE dos planos (C2 do E2E). Depois desta refatoração,
  divergência entre páginas vira impossível por construção: /precos,
  /modelodenegocio, /simulacao, /roi, a calculadora e os badges de plano
  consomem SÓ deste arquivo.

  Modelo híbrido com comissão DECRESCENTE (uma única vez por contrato-mãe,
  sobre 1 aluguel): Gratuito → Essencial → Profissional → Gestor (zero no topo;
  a receita do Gestor é só a assinatura sob consulta). Os percentuais vivem SÓ
  aqui; nas telas, sempre em reais ("12% de um aluguel, uma vez (≈ R$ X)").
  Tabela atual: decisão do Daniel, out/2026.
*/

export type PlanoId = "free" | "essential" | "pro" | "gestor";

export interface Plano {
  id: PlanoId;
  nome: string;
  publico: string; // público-alvo (tagline)
  precoMensal: number | null; // R$/mês (null = sob consulta)
  assinaturaAnual: number | null; // R$/ano (= mensal × 12; null = sob consulta)
  comissao: number; // 0..1 — comissão de fechamento (Gestor = 0)
  limiteAnuncios: number; // anúncios ativos permitidos
  destaque: boolean; // plano em destaque na página de preços
  beneficios: string[];
  custoLabel: string; // texto curto do custo/comissão exibido nos cards
  cta: string;
}

const PLANOS_BASE: Plano[] = [
  {
    id: "free",
    nome: "Gratuito",
    publico: "Para testar a plataforma",
    precoMensal: 0,
    assinaturaAnual: 0,
    comissao: 0.12,
    limiteAnuncios: 1,
    destaque: false,
    beneficios: [
      "1 anúncio ativo (limitado)",
      "Aparece na busca",
      "Recebe consultas de inquilinos",
      "Checklist de qualificação",
    ],
    custoLabel: "",
    cta: "Começar grátis",
  },
  {
    id: "essential",
    nome: "Essencial",
    publico: "Para quem tem alguns imóveis",
    precoMensal: 49,
    assinaturaAnual: 588,
    comissao: 0.08,
    limiteAnuncios: 5,
    destaque: true,
    beneficios: [
      "Até 5 anúncios ativos",
      "Selo Pronto para Morar",
      "Destaque na busca",
      "Painel de leads e mensagens",
    ],
    custoLabel: "",
    cta: "Assinar Essencial",
  },
  {
    id: "pro",
    nome: "Profissional",
    publico: "Para quem vive de locação",
    precoMensal: 129,
    assinaturaAnual: 1548,
    comissao: 0.04,
    limiteAnuncios: 20,
    destaque: false,
    beneficios: [
      "Até 20 anúncios ativos",
      "Tudo do Essencial",
      "Prioridade máxima na busca",
    ],
    custoLabel: "",
    cta: "Assinar Profissional",
  },
  {
    id: "gestor",
    nome: "Gestor",
    publico: "Administradoras e coordenadores",
    precoMensal: null, // sob consulta
    assinaturaAnual: null,
    comissao: 0, // COMISSÃO ZERO no topo (C1) — a receita é só a assinatura
    limiteAnuncios: 999,
    destaque: false,
    beneficios: [
      "Imóveis ilimitados",
      "Tudo do Profissional",
      "Feito para administradoras — recursos de carteira em construção com os primeiros gestores parceiros",
      "Atendimento dedicado",
    ],
    custoLabel: "Comissão zero — você paga só a assinatura",
    cta: "Falar com vendas",
  },
];

/** Texto da comissão, sempre em reais: "12% de um aluguel, uma vez (≈ R$ 288)". */
export function textoComissao(comissao: number, aluguel?: number): string {
  if (comissao === 0) return "Comissão zero: você paga só a assinatura";
  const pct = `${Math.round(comissao * 1000) / 10}`.replace(".", ",");
  const valor = aluguel && aluguel > 0 ? ` (≈ ${reaisInteiros(aluguel * comissao)})` : "";
  return `${pct}% de um aluguel, uma vez por contrato${valor}`;
}

/** Forma curta para tabelas e rótulos com o valor em R$ ao lado: "12% de 1 aluguel". */
export function pctDeUmAluguel(comissao: number): string {
  return comissao === 0 ? "zero" : `${`${Math.round(comissao * 1000) / 10}`.replace(".", ",")}% de 1 aluguel`;
}

/** R$ sem centavos, pt-BR (puro; sem depender de utils). */
export function reaisInteiros(v: number): string {
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

/** Aluguel de exemplo das telas de preço (comparativo e textos). */
export const ALUGUEL_EXEMPLO = 2400;
export const MESES_EXEMPLO = 4;

export const PLANOS: Plano[] = PLANOS_BASE.map((p) => ({
  ...p,
  custoLabel: p.custoLabel || textoComissao(p.comissao, ALUGUEL_EXEMPLO) + (p.comissao ? ` no exemplo de ${reaisInteiros(ALUGUEL_EXEMPLO)}` : ""),
}));

/**
 * Referências de MERCADO para o comparativo (fonte única também — nenhum outro
 * arquivo repete estes números).
 */
export const MERCADO = {
  /** Airbnb: taxa única de 16% para anfitriões no Brasil (central de ajuda do Airbnb, out/2026). */
  airbnbTaxa: 0.16,
  airbnbFonte: "Airbnb: taxa única de 16% para anfitriões no Brasil (central de ajuda do Airbnb, out/2026).",
  /** Imobiliária tradicional (média de mercado): 1º aluguel + 8% de administração ao mês. */
  imobiliariaAdmMensal: 0.08,
  imobiliariaPrimeiroAluguel: 1,
  dataReferencia: "out/2026",
} as const;

/**
 * Todas as taxas que JÁ foram oferecidas (inclui as antigas). Uma taxa
 * congelada no aceite continua valendo mesmo depois de a tabela mudar.
 */
export const TAXAS_HISTORICAS: readonly number[] = [0.12, 0.1, 0.08, 0.04, 0];

const BY_ID: Record<string, Plano> = Object.fromEntries(PLANOS.map((p) => [p.id, p]));

export function plano(id: string): Plano | undefined {
  return BY_ID[id];
}

/** Comissão de fechamento por plano (0..1). Derivada da fonte única. */
export const COMISSAO_POR_PLANO: Record<PlanoId, number> = Object.fromEntries(
  PLANOS.map((p) => [p.id, p.comissao])
) as Record<PlanoId, number>;

/** Limite de anúncios por plano. Derivado da fonte única. */
export const LIMITE_ANUNCIOS: Record<PlanoId, number> = Object.fromEntries(
  PLANOS.map((p) => [p.id, p.limiteAnuncios])
) as Record<PlanoId, number>;

/**
 * Assinatura média por um MIX declarado de planos — premissa do /roi (C3).
 * Ex.: 50% Gratuito, 35% Essencial, 15% Profissional. Ignora o Gestor (sob
 * consulta). Retorna R$/mês médio ponderado.
 */
export const MIX_ROI: Record<PlanoId, number> = {
  free: 0.5,
  essential: 0.35,
  pro: 0.15,
  gestor: 0,
};

/** Comissão média (em %) pelo mix declarado — premissa dos simuladores internos. */
export function comissaoMediaMixPct(mix: Record<PlanoId, number> = MIX_ROI): number {
  let soma = 0;
  let peso = 0;
  for (const p of PLANOS) {
    const w = mix[p.id] ?? 0;
    soma += p.comissao * w;
    peso += w;
  }
  return peso > 0 ? Math.round((soma / peso) * 1000) / 10 : 0;
}

export function assinaturaMediaMix(mix: Record<PlanoId, number> = MIX_ROI): number {
  let soma = 0;
  let peso = 0;
  for (const p of PLANOS) {
    if (p.precoMensal == null) continue;
    const w = mix[p.id] ?? 0;
    soma += p.precoMensal * w;
    peso += w;
  }
  return peso > 0 ? Math.round(soma / peso) : 0;
}

/**
 * Taxa de comissão que vale para um contrato: a CONGELADA no aceite; se ela não
 * foi gravada (null) ou não é uma taxa real de plano, a do PLANO registrado no
 * aceite; sem plano válido, a do Gratuito. Antes `Number(null)` virava 0 — a
 * taxa do Gestor — e a comissão saía R$ 0.
 */
export function taxaDoContrato(congelada: unknown, planoNoAceite: unknown): number {
  // Vale a taxa do ACEITE, mesmo que a tabela tenha mudado depois.
  const validas = new Set([...TAXAS_HISTORICAS, ...Object.values(COMISSAO_POR_PLANO)]);
  if (congelada !== null && congelada !== undefined && congelada !== "") {
    const n = Number(congelada);
    if (Number.isFinite(n) && validas.has(n)) return n;
  }
  if (typeof planoNoAceite === "string" && planoNoAceite in COMISSAO_POR_PLANO) {
    return COMISSAO_POR_PLANO[planoNoAceite as PlanoId];
  }
  return COMISSAO_POR_PLANO.free;
}

/**
 * Assinatura anual do Gestor usada SÓ em modelos internos (/modelodenegocio).
 * O preço público é "sob consulta" — nunca exibir como preço do plano.
 */
export const GESTOR_ASSINATURA_ANUAL_ESTIMADA = 3000;

/**
 * Regras do CONTRATO — fonte única (prazo, teto legal, caução, blocos).
 * Lei 8.245/91: temporada até 90 dias por bloco (art. 48); caução até 3
 * aluguéis (art. 38 §2º). Produto: prazo de 1 a 6 meses, no máximo 180 dias.
 */
export const REGRAS_CONTRATO = {
  prazoMinMeses: 1,
  prazoMaxMeses: 6,
  prazoMaxDias: 180,
  diasPorMes: 30,
  maxDiasBloco: 90,
  mesesPorBlocoPadrao: 2,
  /** Caução de cada bloco = 50% do valor do bloco. */
  caucaoFracaoBloco: 0.5,
  /** Soma das cauções do contrato ≤ 3 aluguéis (art. 38 §2º). */
  caucaoMaxAlugueis: 3,
} as const;
