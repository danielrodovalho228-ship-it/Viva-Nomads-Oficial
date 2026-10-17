/**
 * Fórmulas dos simuladores do PROPRIETÁRIO (fonte única, PURA e testável — sem
 * imports de valor, só `import type`, que é apagado em runtime). Uma fonte de
 * cálculo, várias telas: /dashboard/simulador (rentabilidade) e
 * /dashboard/roi-imovel (ROI de mobiliar). As telas injetam comissão/assinatura
 * vindas de config/planos.ts (fonte única dos planos).
 *
 * Regra de ouro: os números são ESTIMATIVA ILUSTRATIVA — não é promessa de
 * rentabilidade. A plataforma nunca movimenta o aluguel.
 */
import type { PlanoId } from "@/config/planos";

/** Descrição mínima de um plano para o comparador (injetada pela tela). */
export interface PlanoCalc {
  id: PlanoId;
  nome: string;
  comissao: number; // 0..1
  assinaturaAnual: number | null; // null = sob consulta (Gestor)
}

/**
 * Como condomínio/IPTU e contas de consumo chegam ao morador (prompt 15):
 * - "aparte" (PADRÃO da Viva, igual ao card do anúncio): o morador paga junto com o valor mensal; não é custo do
 *   proprietário nos meses ocupados. Nos meses VAZIOS o proprietário paga condomínio/IPTU (contas, não).
 * - "incluido": já estão dentro do valor mensal; o proprietário paga condomínio/IPTU nos 12 meses e as contas
 *   nos meses ocupados.
 */
export type Cobranca = "aparte" | "incluido";

export interface EntradaRentabilidade {
  /** Valor mensal pretendido (nome interno antigo; nunca aparece na tela). */
  aluguelMensal: number;
  condoIptu: number; // condomínio + IPTU mensais
  contas: number; // água/luz/internet por mês ocupado
  mesesOcupados: number; // 6..12
  prazoMedioMeses: number; // 2/3/4/6
  /** Padrão: "aparte". */
  condoCobranca?: Cobranca;
  /** Padrão: "aparte". */
  contasCobranca?: Cobranca;
  /** Valor do imóvel (opcional): rentabilidade sobre o valor do imóvel. */
  valorImovel?: number;
}

/** Base ÚNICA do imóvel mobiliado no ano (simulador e ROI usam a mesma conta). */
export interface BaseMobiliadoAno {
  receitaBrutaAnual: number;
  custosAnuais: number;
  taxaVivaAnual: number;
  liquidaAnual: number;
}

/**
 * Receita bruta = valor mensal × meses ocupados. Taxa da Viva = taxa × valor mensal × meses ocupados (= taxa sobre
 * o valor total dos contratos; nunca sobre condomínio/contas cobrados à parte — regra.ts). Custos conforme `Cobranca`.
 */
export function baseMobiliadoAno(
  e: { valorMensal: number; condoIptu: number; contas: number; mesesOcupados: number; condoCobranca?: Cobranca; contasCobranca?: Cobranca },
  taxa: number,
): BaseMobiliadoAno {
  const valor = n(e.valorMensal);
  const meses = Math.min(12, Math.max(0, e.mesesOcupados));
  const vazios = 12 - meses;
  const condo = (e.condoCobranca ?? "aparte") === "aparte" ? n(e.condoIptu) * vazios : n(e.condoIptu) * 12;
  const contas = (e.contasCobranca ?? "aparte") === "aparte" ? 0 : n(e.contas) * meses;
  const receitaBrutaAnual = valor * meses;
  const custosAnuais = condo + contas;
  const taxaVivaAnual = Math.max(0, taxa) * valor * meses;
  return {
    receitaBrutaAnual: Math.round(receitaBrutaAnual),
    custosAnuais: Math.round(custosAnuais),
    taxaVivaAnual: Math.round(taxaVivaAnual),
    liquidaAnual: Math.round(receitaBrutaAnual - custosAnuais - taxaVivaAnual),
  };
}

/** Rentabilidade sobre o valor do imóvel (ao ano, 0..1); null sem valor informado. */
export function rentabilidadeSobreImovel(liquidaAnual: number, valorImovel: number | undefined): number | null {
  const v = n(valorImovel ?? 0);
  return v > 0 ? liquidaAnual / v : null;
}

export interface ResultadoRentabilidade {
  /** Rentabilidade líquida sobre o valor do imóvel (ao ano); null sem valor do imóvel. */
  rentabilidadeImovel: number | null;
  contratosPorAno: number;
  receitaBrutaAnual: number;
  custosAnuais: number;
  comissaoAnual: number;
  assinaturaAnual: number;
  receitaLiquidaAnual: number;
  mediaMensal: number;
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

/** Contratos fechados por ano (estimativa) = meses ocupados / prazo médio. */
export function contratosPorAno(mesesOcupados: number, prazoMedioMeses: number): number {
  const meses = Math.min(12, Math.max(0, mesesOcupados));
  const prazo = Math.max(1, prazoMedioMeses);
  return meses / prazo;
}

/**
 * Comissão do ano: a taxa incide sobre o valor TOTAL de cada contrato (aluguel × meses do contrato — ordem do
 * Daniel, 14/10), e não só sobre o 1º aluguel. Contratos/ano × prazo = meses ocupados (prazo mínimo de 1 mês).
 */
export function comissaoAnualSobreTotal(contratos: number, prazoMedioMeses: number, taxa: number, aluguel: number): number {
  return contratos * Math.max(1, prazoMedioMeses) * Math.max(0, taxa) * aluguel;
}

export function simularRentabilidade(
  e: EntradaRentabilidade,
  comissaoPct: number,
  assinaturaAno: number
): ResultadoRentabilidade {
  const meses = Math.min(12, Math.max(0, e.mesesOcupados));
  const contratos = contratosPorAno(meses, e.prazoMedioMeses);
  const b = baseMobiliadoAno({ ...e, valorMensal: e.aluguelMensal }, comissaoPct);
  const assin = n(assinaturaAno);
  const receitaLiquidaAnual = b.liquidaAnual - assin;

  return {
    contratosPorAno: contratos,
    receitaBrutaAnual: b.receitaBrutaAnual,
    custosAnuais: b.custosAnuais,
    comissaoAnual: b.taxaVivaAnual,
    assinaturaAnual: assin,
    receitaLiquidaAnual,
    mediaMensal: Math.round(receitaLiquidaAnual / 12),
    rentabilidadeImovel: rentabilidadeSobreImovel(receitaLiquidaAnual, e.valorImovel),
  };
}

export interface LinhaComparador {
  planoId: PlanoId;
  nome: string;
  comissaoPct: number;
  assinaturaAnual: number;
  comissaoAnual: number;
  totalVivaAnual: number;
  liquidoProprietario: number;
  sobConsulta: boolean;
}

/** Compara os planos com os MESMOS inputs (o "vendedor silencioso" do Fundador). */
export function compararPlanos(e: EntradaRentabilidade, planos: PlanoCalc[]): LinhaComparador[] {
  return planos.map((p) => {
    const b = baseMobiliadoAno({ ...e, valorMensal: e.aluguelMensal }, p.comissao);
    const receitaBruta = b.receitaBrutaAnual;
    const custos = b.custosAnuais;
    const comissaoAnual = b.taxaVivaAnual;
    const assin = p.assinaturaAnual ?? 0;
    const totalViva = comissaoAnual + assin;
    return {
      planoId: p.id,
      nome: p.nome,
      comissaoPct: p.comissao,
      assinaturaAnual: assin,
      comissaoAnual,
      totalVivaAnual: totalViva,
      liquidoProprietario: Math.round(receitaBruta - custos - totalViva),
      sobConsulta: p.assinaturaAnual == null,
    };
  });
}

export interface Recomendacao {
  planoId: PlanoId;
  nome: string;
  motivo: string;
}

/**
 * Recomenda o plano pelo VOLUME real do proprietário (regra 3): o que deixa mais
 * líquido no bolso dele com os inputs informados. A honestidade É a feature — se
 * a resposta é "o Gratuito é seu melhor plano", é isso que aparece. O Gestor
 * (sob consulta / venda assistida) fica FORA da recomendação automática.
 */
export function recomendarPlano(
  e: EntradaRentabilidade,
  planos: PlanoCalc[]
): Recomendacao | null {
  const linhas = compararPlanos(e, planos).filter((l) => !l.sobConsulta);
  if (!linhas.length) return null;
  // Maior líquido ao proprietário vence (empate → mantém o primeiro, mais barato).
  const melhor = linhas.reduce((a, b) =>
    b.liquidoProprietario > a.liquidoProprietario ? b : a
  );
  const meses = Math.min(12, Math.max(0, e.mesesOcupados));
  const contratos = contratosPorAno(meses, e.prazoMedioMeses);
  const nCon = Math.round(contratos * 10) / 10;
  const motivo = `Com ~${nCon} contrato(s)/ano no valor informado, o ${melhor.nome} deixa mais no seu bolso.`;
  return { planoId: melhor.planoId, nome: melhor.nome, motivo };
}

export interface EntradaROI {
  investimentoMobiliar: number;
  aluguelVazio: number;
  aluguelMobiliado: number;
  mesesOcupados: number;
  prazoMedioMeses: number;
  /** Contas incluídas no aluguel mobiliado (água, luz, internet), por mês ocupado. */
  contasMensais?: number;
  /** Reposição e desgaste da mobília, em % do investimento por ano (ex.: 0.1). */
  reposicaoAnualPct?: number;
  /** Condomínio + IPTU mensais (custo nos meses vazios dos DOIS cenários quando cobrados à parte). */
  condoIptu?: number;
  /** Padrão "aparte" (igual ao simulador). */
  condoCobranca?: Cobranca;
  /** Padrão "aparte": contas pagas pelo morador nos meses ocupados. */
  contasCobranca?: Cobranca;
  /** Contrato tradicional (12+ meses): meses vazios por ano. Padrão 1 (referência de mercado — confira). */
  mesesVaziosTradicional?: number;
  /** Contrato tradicional: taxa de administração da imobiliária (0..1). Padrão 0,10. */
  taxaAdmTradicional?: number;
  /** Contrato tradicional: 1 valor mensal de intermediação a cada N meses de contrato. Padrão 30; 0 = sem. */
  intermediacaoACadaMeses?: number;
  /** Rendimento anual se o investimento ficasse aplicado (0..1), opcional — sem taxa fixa no código. */
  rendimentoAplicacaoPct?: number;
}

/** Padrões do contrato tradicional (referência de mercado — confira com a sua imobiliária). */
export const PADROES_TRADICIONAL = { mesesVazios: 1, taxaAdm: 0.1, intermediacaoACadaMeses: 30 } as const;

/** Líquido anual do contrato tradicional (12+ meses), sem mobília. */
export function liquidoTradicionalAnual(e: {
  valorMensal: number;
  condoIptu?: number;
  mesesVazios?: number;
  taxaAdm?: number;
  intermediacaoACadaMeses?: number;
}): number {
  const v = n(e.valorMensal);
  const vazios = Math.min(12, Math.max(0, e.mesesVazios ?? PADROES_TRADICIONAL.mesesVazios));
  const adm = Math.min(1, Math.max(0, e.taxaAdm ?? PADROES_TRADICIONAL.taxaAdm));
  const cada = e.intermediacaoACadaMeses ?? PADROES_TRADICIONAL.intermediacaoACadaMeses;
  const intermediacao = cada > 0 ? (v * 12) / cada : 0;
  return Math.round(v * (12 - vazios) * (1 - adm) - intermediacao - n(e.condoIptu ?? 0) * vazios);
}

export interface ResultadoROI {
  /** Diferença mensal mobiliado − vazio. PODE ser negativa. */
  premioMensal: number;
  premioPct: number;
  netMobiliadoAnual: number;
  netVazioAnual: number;
  ganhoAdicionalAnual: number;
  /** 0 = imediato (sem investimento e com ganho); null = não se paga. */
  paybackMeses: number | null;
  /** null quando não há investimento (ROI indefinido). */
  roiAnual: number | null;
  /** Custos do mobiliado no ano (condomínio/contas conforme a cobrança + reposição), já descontados. */
  custosMobiliadoAnual: number;
  acumulado: { ano: number; mobiliado: number; vazio: number }[];
  /** Ponto de equilíbrio: valor mensal mobiliado mínimo para empatar com o tradicional (R$, arredondado p/ cima). */
  valorMinimoEmpate: number | null;
  /** Ponto de equilíbrio: meses ocupados mínimos por ano para empatar (1..12); null se nem com 12 empata. */
  ocupacaoMinimaEmpate: number | null;
  /** Ganho do mobiliado acima (positivo) ou abaixo (negativo) do rendimento da aplicação; null sem rendimento. */
  versusAplicacaoAnual: number | null;
}

export function simularROI(e: EntradaROI, comissaoPct: number, assinaturaAno: number): ResultadoROI {
  const meses = Math.min(12, Math.max(0, e.mesesOcupados));
  const vazio = n(e.aluguelVazio);
  const mob = n(e.aluguelMobiliado);
  const invest = n(e.investimentoMobiliar);

  // Prêmio de verdade: negativo quando o mobiliado rende menos que o vazio.
  const premioMensal = mob - vazio;
  const premioPct = vazio > 0 ? premioMensal / vazio : 0;

  const reposicaoAnual = invest * Math.max(0, e.reposicaoAnualPct ?? 0);
  const assin = n(assinaturaAno);
  const baseDe = (valor: number, m: number) =>
    baseMobiliadoAno(
      { valorMensal: valor, condoIptu: n(e.condoIptu ?? 0), contas: n(e.contasMensais ?? 0), mesesOcupados: m, condoCobranca: e.condoCobranca, contasCobranca: e.contasCobranca },
      comissaoPct,
    );
  const liquidoMob = (valor: number, m: number) => baseDe(valor, m).liquidaAnual - reposicaoAnual - assin;

  const b = baseDe(mob, meses);
  const custosMobiliadoAnual = Math.round(b.custosAnuais + reposicaoAnual);
  const netMobiliadoAnual = Math.round(liquidoMob(mob, meses));
  const netVazioAnual = liquidoTradicionalAnual({
    valorMensal: vazio,
    condoIptu: e.condoIptu,
    mesesVazios: e.mesesVaziosTradicional,
    taxaAdm: e.taxaAdmTradicional,
    intermediacaoACadaMeses: e.intermediacaoACadaMeses,
  });
  const ganhoAdicionalAnual = netMobiliadoAnual - netVazioAnual;

  // Sem investimento e com ganho → payback imediato e ROI indefinido.
  const paybackMeses =
    ganhoAdicionalAnual > 0 ? (invest > 0 ? Math.ceil(invest / (ganhoAdicionalAnual / 12)) : 0) : null;
  const roiAnual = invest > 0 ? ganhoAdicionalAnual / invest : null;

  const acumulado = [1, 2, 3].map((ano) => ({
    ano,
    mobiliado: Math.round(netMobiliadoAnual * ano - invest),
    vazio: Math.round(netVazioAnual * ano),
  }));

  // Ponto de equilíbrio (sobre o líquido do ano, sem o investimento inicial).
  // Valor mínimo: o líquido cresce linear com o valor → resolve por busca binária em R$ inteiros.
  let valorMinimoEmpate: number | null = null;
  if (meses > 0 && liquidoMob(1_000_000, meses) >= netVazioAnual) {
    let lo = 0;
    let hi = 1_000_000;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (liquidoMob(mid, meses) >= netVazioAnual) hi = mid;
      else lo = mid + 1;
    }
    valorMinimoEmpate = lo;
  }
  let ocupacaoMinimaEmpate: number | null = null;
  for (let m = 1; m <= 12; m++) {
    if (liquidoMob(mob, m) >= netVazioAnual) {
      ocupacaoMinimaEmpate = m;
      break;
    }
  }
  const rend = e.rendimentoAplicacaoPct;
  const versusAplicacaoAnual = rend != null && rend > 0 && invest > 0 ? Math.round(ganhoAdicionalAnual - invest * rend) : null;

  return {
    premioMensal,
    premioPct,
    netMobiliadoAnual,
    netVazioAnual,
    ganhoAdicionalAnual,
    paybackMeses,
    roiAnual,
    custosMobiliadoAnual,
    acumulado,
    valorMinimoEmpate,
    ocupacaoMinimaEmpate,
    versusAplicacaoAnual,
  };
}
