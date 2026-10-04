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

export interface EntradaRentabilidade {
  aluguelMensal: number;
  condoIptu: number; // condomínio + IPTU mensais (o dono paga o ano todo)
  contas: number; // água/luz/internet incluídas (durante a ocupação)
  mesesOcupados: number; // 6..12
  prazoMedioMeses: number; // 2/3/4/6
}

export interface ResultadoRentabilidade {
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

export function simularRentabilidade(
  e: EntradaRentabilidade,
  comissaoPct: number,
  assinaturaAno: number
): ResultadoRentabilidade {
  const aluguel = n(e.aluguelMensal);
  const meses = Math.min(12, Math.max(0, e.mesesOcupados));
  const contratos = contratosPorAno(meses, e.prazoMedioMeses);

  const receitaBrutaAnual = aluguel * meses;
  const custosAnuais = n(e.condoIptu) * 12 + n(e.contas) * meses;
  const comissaoAnual = Math.round(contratos * Math.max(0, comissaoPct) * aluguel);
  const assin = n(assinaturaAno);
  const receitaLiquidaAnual = Math.round(receitaBrutaAnual - custosAnuais - comissaoAnual - assin);

  return {
    contratosPorAno: contratos,
    receitaBrutaAnual: Math.round(receitaBrutaAnual),
    custosAnuais: Math.round(custosAnuais),
    comissaoAnual,
    assinaturaAnual: assin,
    receitaLiquidaAnual,
    mediaMensal: Math.round(receitaLiquidaAnual / 12),
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
  const aluguel = n(e.aluguelMensal);
  const meses = Math.min(12, Math.max(0, e.mesesOcupados));
  const contratos = contratosPorAno(meses, e.prazoMedioMeses);
  const receitaBruta = aluguel * meses;
  const custos = n(e.condoIptu) * 12 + n(e.contas) * meses;

  return planos.map((p) => {
    const comissaoAnual = Math.round(contratos * Math.max(0, p.comissao) * aluguel);
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
  /** Custos do mobiliado no ano (contas + reposição), já descontados. */
  custosMobiliadoAnual: number;
  acumulado: { ano: number; mobiliado: number; vazio: number }[];
}

export function simularROI(e: EntradaROI, comissaoPct: number, assinaturaAno: number): ResultadoROI {
  const meses = Math.min(12, Math.max(0, e.mesesOcupados));
  const vazio = n(e.aluguelVazio);
  const mob = n(e.aluguelMobiliado);
  const invest = n(e.investimentoMobiliar);
  const contratos = contratosPorAno(meses, e.prazoMedioMeses);

  // Prêmio de verdade: negativo quando o mobiliado rende menos que o vazio
  // (antes ficava "+R$ 0 (0%)" ao lado de um ganho negativo).
  const premioMensal = mob - vazio;
  const premioPct = vazio > 0 ? premioMensal / vazio : 0;

  // F4: o mobiliado paga as contas incluídas e repõe a mobília.
  const contasAnual = n(e.contasMensais ?? 0) * meses;
  const reposicaoAnual = invest * Math.max(0, e.reposicaoAnualPct ?? 0);
  const custosMobiliadoAnual = Math.round(contasAnual + reposicaoAnual);

  const comissaoAnualMob = contratos * Math.max(0, comissaoPct) * mob;
  const netMobiliadoAnual = Math.round(mob * meses - comissaoAnualMob - n(assinaturaAno) - custosMobiliadoAnual);
  const netVazioAnual = Math.round(vazio * 12);
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
  };
}
