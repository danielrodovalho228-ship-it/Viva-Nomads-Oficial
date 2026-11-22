/*
  FONTE ÚNICA DA VERDADE dos planos (C2 do E2E). Depois desta refatoração,
  divergência entre páginas vira impossível por construção: /precos,
  /modelodenegocio, /simulacao, /roi, a calculadora e os badges de plano
  consomem SÓ deste arquivo.

  HISTÓRICO (modelo antigo de planos com mensalidade, NÃO é o vigente — ordem 5df28a7b):
  Gratuito → Essencial → Profissional → Gestor. A cobrança vigente é só comissão, pelas faixas de
  src/lib/cobranca/regra.ts, sobre o valor total de cada contrato e de cada renovação.
  Nas telas, sempre em reais ("12% do valor total do contrato (≈ R$ X por mês de aluguel)").
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
      "Recebe consultas de moradores",
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
    comissao: 0.04, // E564 (04/11/2026): Gestor = taxa de 4% por contrato, sem assinatura nem taxa zero
    limiteAnuncios: 999,
    destaque: false,
    // E564 (parte A): só os diferenciais do lançamento (GESTOR_DIFERENCIAIS) — nada da fase 2.
    beneficios: [
      "Taxa de serviço de 4% sobre o valor total de cada contrato",
      "Cadastro assistido da carteira",
      "Contato direto na Viva",
      "Suporte prioritário",
    ],
    custoLabel: "Taxa de serviço de 4% do valor total do contrato, sem assinatura",
    cta: "Falar com vendas",
  },
];

/** Texto da comissão, sempre em reais: "12% do valor total do contrato (≈ R$ 288 por mês de aluguel)". */
export function textoComissao(comissao: number, aluguel?: number): string {
  const pct = `${Math.round(comissao * 1000) / 10}`.replace(".", ",");
  const valor = aluguel && aluguel > 0 ? ` (≈ ${reaisInteiros(aluguel * comissao)} por mês de aluguel)` : "";
  return `${pct}% do valor total do contrato${valor}`;
}

/** Forma curta para tabelas e rótulos com o valor em R$ ao lado: "12% do valor total". */
export function pctDoValorTotal(comissao: number): string {
  return comissao === 0 ? "zero" : `${`${Math.round(comissao * 1000) / 10}`.replace(".", ",")}% do valor total`;
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
  // E292-bis: a taxa do Airbnb (16%) saiu daqui — era usada só pelo "preço sugerido", que deixou de existir.
  /** Imobiliária tradicional (média de mercado): um aluguel inteiro de intermediação + 8% de administração ao mês. */
  imobiliariaAdmMensal: 0.08,
  imobiliariaPrimeiroAluguel: 1,
  dataReferencia: "out/2026",
} as const;

/**
 * Todas as taxas que JÁ foram oferecidas (inclui as antigas). Uma taxa
 * congelada no aceite continua valendo mesmo depois de a tabela mudar.
 */
export const TAXAS_HISTORICAS: readonly number[] = [0.12, 0.1, 0.08, 0.06, 0.04, 0];

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
 * E564 (decisão do Daniel, 04/11/2026; desenho validado nos Relays 68–70): o Plano Gestor é a TAXA de 4% por contrato
 * para carteiras de `minimoImoveis`+ imóveis ativos de verdade (E565) ou conta de administradora. Sem assinatura no
 * lançamento: saíram a mensalidade de R$ 500 com 20 imóveis incluídos, os R$ 25 por imóvel extra e a taxa zero.
 * A faixa "31+ negociável" deixou de existir. A fase 2 (equipe/permissões, operações em massa, sincronização,
 * mensalidade-mínimo) é desenho futuro, fora desta regra. A faixa de 4% está em lib/cobranca/regra.ts.
 */
export const GESTOR_PRECO = {
  ligado: true,
  minimoImoveis: 20,
  taxa: 0.04,
} as const;

/**
 * E321/E564: a PORTA do Plano Gestor, igual em todas as telas — N+ imóveis ativos de verdade (publicados, com documento
 * aprovado e calendário em dia) OU conta de administradora (a mesma regra de gestorElegivel e da faixa de 4%).
 */
export const PORTA_GESTOR_TEXTO = `${GESTOR_PRECO.minimoImoveis} imóveis ou mais ativos (publicados, com documento aprovado e calendário em dia), ou conta de administradora`;

/** "taxa de 4% por contrato · sem assinatura · para carteiras de 20+ imóveis" */
export const GESTOR_RESUMO = `taxa de ${`${Math.round(GESTOR_PRECO.taxa * 1000) / 10}`.replace(".", ",")}% por contrato · sem assinatura · para carteiras de ${GESTOR_PRECO.minimoImoveis}+ imóveis`;

/**
 * E564 (parte A): o texto único do Gestor nas telas — 4%, carteiras de 20+, cadastro assistido e contato direto. Sai da
 * mesma constante da regra (GESTOR_PRECO).
 */
const GESTOR_PCT = String(Math.round(GESTOR_PRECO.taxa * 1000) / 10).replace(".", ",");
// E905: com a alternativa aprovada "ou conta de administradora" (a mesma da home e da Ajuda, PORTA_GESTOR_TEXTO).
export const GESTOR_TEXTO = `${GESTOR_PCT}% para carteiras de ${GESTOR_PRECO.minimoImoveis} ou mais imóveis ou conta de administradora, com cadastro assistido da carteira e contato direto na Viva`;

/** Os únicos diferenciais anunciáveis no lançamento (nada da fase 2: equipe, operações em massa, sincronização). */
export const GESTOR_DIFERENCIAIS = [
  "Taxa de serviço de 4% sobre o valor total de cada contrato",
  "Cadastro assistido da carteira",
  "Contato direto na Viva",
  "Suporte prioritário",
] as const;

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
