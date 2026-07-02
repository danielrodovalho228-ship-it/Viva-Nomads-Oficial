/**
 * Modelo de receita do Simulador (Viva Nomads) — funções PURAS e determinísticas.
 *
 * Fonte única da lógica exibida em /simulacao. As fórmulas e os valores padrão
 * são os validados na versão anterior da página — NÃO altere sem revalidar os
 * testes em `model.test.ts` (os números batem com os casos de aceite do produto).
 *
 * Convenções:
 * - Percentuais de entrada (comissão, crescimento, conversão, churn) chegam como
 *   número inteiro/decimal em "pontos percentuais" (ex.: 8 = 8%).
 * - `margem` e `roi` são devolvidos como FRAÇÃO (0..1); use `formatPct` para exibir.
 * - Na projeção NÃO se arredonda entre meses (floats acumulam); só a base final
 *   é arredondada na exibição.
 */

export interface Premissas {
  /** Aluguel médio por mês (R$). */
  aluguel: number;
  /** Duração média da estadia (meses) — informativo, não entra no cálculo mensal. */
  duracao: number;
  /** Comissão sobre o 1º mês (%). */
  comissaoPct: number;
  /** Mensalidade do plano pago (R$). */
  mensalidadePlano: number;
  /** Repasse de serviço por contrato (R$) — "Aqui Resolve". */
  repasseServico: number;
  /** Comissão de garantia por contrato (R$). */
  comissaoGarantia: number;
  /** Receita de destaque/anúncio por contrato (R$). */
  receitaDestaque: number;
  /** Custo FIXO mensal (R$). */
  custoFixo: number;
  /** Custo VARIÁVEL por contrato (R$). */
  custoVariavel: number;
}

export interface Volumes {
  /** Aluguéis fechados no mês. */
  alugueisMes: number;
  /** Base acumulada de planos pagos. */
  basePlanos: number;
  /** Contratos com destaque/anúncio no mês. */
  contratosDestaque: number;
}

export interface ProjecaoParams {
  /** Horizonte em meses (1..60). */
  horizonte: number;
  /** Novos aluguéis por mês (base do mês 1). */
  novosBase: number;
  /** Crescimento mensal dos fechamentos (%). */
  crescimento: number;
  /** Conversão dos novos aluguéis em plano pago (%). */
  conversao: number;
  /** Churn mensal da base de planos (%). */
  churn: number;
  /** Base inicial de planos. */
  baseInicial: number;
}

/** Receita mensal decomposta por fonte + total. */
export interface ReceitaFontes {
  comissao: number;
  planos: number;
  garantia: number;
  servicos: number;
  destaque: number;
  total: number;
}

/** Resultado completo de um mês: receita por fonte + custo + indicadores. */
export interface ResultadoMes extends ReceitaFontes {
  custo: number;
  lucro: number;
  /** Fração 0..1 (lucro ÷ receita). */
  margem: number;
  /** Fração 0..1 (lucro ÷ custo). */
  roi: number;
}

/** Um mês na projeção, com acumulados. */
export interface MesProjecao {
  /** Índice do mês (1..N). */
  m: number;
  /** Novos aluguéis do mês (float, com crescimento composto). */
  novos: number;
  /** Base de planos ao fim do mês (float). */
  base: number;
  receita: number;
  custo: number;
  lucro: number;
  receitaAcumulada: number;
  lucroAcumulado: number;
}

export interface ResultadoProjecao {
  meses: MesProjecao[];
  receitaAcumulada: number;
  lucroAcumulado: number;
  /** Base de planos no último mês (float; arredonde só na exibição). */
  baseFinal: number;
  receitaUltimoMes: number;
}

/** Chave + rótulo + cor + descrição de cada fonte (mesma ordem/cor do gráfico). */
export interface FonteReceita {
  key: keyof ReceitaFontes;
  label: string;
  color: string;
  desc: string;
}

// ── Valores padrão (validados) ──
export const PREMISSAS_PADRAO: Premissas = {
  aluguel: 3000,
  duracao: 4,
  comissaoPct: 8,
  mensalidadePlano: 129,
  repasseServico: 20,
  comissaoGarantia: 50,
  receitaDestaque: 30,
  custoFixo: 4000,
  custoVariavel: 120,
};

export const VOLUMES_PADRAO: Volumes = {
  alugueisMes: 10,
  basePlanos: 40,
  contratosDestaque: 6,
};

export const PROJECAO_PADRAO: ProjecaoParams = {
  horizonte: 12,
  novosBase: 10,
  crescimento: 5,
  conversao: 70,
  churn: 3,
  baseInicial: 0,
};

/** Fração de aluguéis que também levam destaque nos cenários (≈60%). */
export const DESTAQUE_RATIO = 0.6;

export const CENARIOS: { nome: string; alugueisMes: number; basePlanos: number }[] = [
  { nome: "Início", alugueisMes: 5, basePlanos: 20 },
  { nome: "Tração", alugueisMes: 20, basePlanos: 120 },
  { nome: "Escala", alugueisMes: 60, basePlanos: 500 },
];

export const FONTES: FonteReceita[] = [
  {
    key: "comissao",
    label: "Comissão por aluguel",
    color: "#1e63d0",
    desc: "% sobre o 1º aluguel de cada contrato fechado.",
  },
  {
    key: "planos",
    label: "Mensalidade dos planos",
    color: "#6cbe2a",
    desc: "Assinatura recorrente da base de proprietários no plano pago.",
  },
  {
    key: "garantia",
    label: "Comissão de garantia",
    color: "#c8a24b",
    desc: "Receita por contrato que usa garantia.",
  },
  {
    key: "servicos",
    label: "Serviços (Aqui Resolve)",
    color: "#5a8a6b",
    desc: "Repasse por serviço prestado no contrato.",
  },
  {
    key: "destaque",
    label: "Destaque / anúncio",
    color: "#0f3d2e",
    desc: "Anúncios premium/destaque no período.",
  },
];

/** Receita do mês decomposta por fonte (sem custo). */
export function receitaPorFonte(p: Premissas, v: Volumes): ReceitaFontes {
  const comissao = v.alugueisMes * p.aluguel * (p.comissaoPct / 100);
  const planos = v.basePlanos * p.mensalidadePlano;
  const garantia = v.alugueisMes * p.comissaoGarantia;
  const servicos = v.alugueisMes * p.repasseServico;
  const destaque = v.contratosDestaque * p.receitaDestaque;
  return {
    comissao,
    planos,
    garantia,
    servicos,
    destaque,
    total: comissao + planos + garantia + servicos + destaque,
  };
}

/**
 * Indicadores do mês: receita por fonte + custo + lucro + margem + ROI.
 * Custo do mês = fixo + variável × aluguéis fechados (ROI realista com o volume).
 */
export function calcularMes(p: Premissas, v: Volumes): ResultadoMes {
  const r = receitaPorFonte(p, v);
  const custo = p.custoFixo + p.custoVariavel * v.alugueisMes;
  const lucro = r.total - custo;
  return {
    ...r,
    custo,
    lucro,
    margem: r.total > 0 ? lucro / r.total : 0,
    roi: custo > 0 ? lucro / custo : 0,
  };
}

/**
 * Projeção mês a mês (floats, sem arredondar entre meses).
 *
 * Atenção: na projeção o destaque incide sobre TODOS os novos aluguéis do mês
 * (novos_m) — diferente do painel mensal, onde usa `contratosDestaque`. Isso é
 * proposital (mantém o comportamento validado).
 */
export function calcularProjecao(p: Premissas, params: ProjecaoParams): ResultadoProjecao {
  const N = Math.min(60, Math.max(1, Math.round(params.horizonte)));
  const g = params.crescimento / 100;
  const conv = params.conversao / 100;
  const churn = params.churn / 100;

  const meses: MesProjecao[] = [];
  let base = params.baseInicial;
  let receitaAcumulada = 0;
  let lucroAcumulado = 0;

  for (let m = 1; m <= N; m++) {
    const novos = params.novosBase * Math.pow(1 + g, m - 1);
    base = base * (1 - churn) + novos * conv;
    // Reusa a mesma fórmula do mês: destaque sobre TODOS os novos aluguéis.
    const r = receitaPorFonte(p, {
      alugueisMes: novos,
      basePlanos: base,
      contratosDestaque: novos,
    });
    const custo = p.custoFixo + p.custoVariavel * novos;
    const lucro = r.total - custo;
    receitaAcumulada += r.total;
    lucroAcumulado += lucro;
    meses.push({
      m,
      novos,
      base,
      receita: r.total,
      custo,
      lucro,
      receitaAcumulada,
      lucroAcumulado,
    });
  }

  const last = meses[meses.length - 1];
  return {
    meses,
    receitaAcumulada,
    lucroAcumulado,
    baseFinal: last.base,
    receitaUltimoMes: last.receita,
  };
}

/** Receita total de um cenário (mesmas premissas, volumes do preset). */
export function receitaCenario(
  p: Premissas,
  cenario: { alugueisMes: number; basePlanos: number },
): number {
  return receitaPorFonte(p, {
    alugueisMes: cenario.alugueisMes,
    basePlanos: cenario.basePlanos,
    contratosDestaque: Math.round(cenario.alugueisMes * DESTAQUE_RATIO),
  }).total;
}

// ── Formatação (pt-BR) ──

/** R$ com separador de milhar por ponto, sem centavos. */
export function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/** Fração (0..1) → percentual inteiro (ex.: 0.3839 → "38%"). */
export function formatPct(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

/** Inteiro com separador de milhar pt-BR (ex.: base de planos). */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}
