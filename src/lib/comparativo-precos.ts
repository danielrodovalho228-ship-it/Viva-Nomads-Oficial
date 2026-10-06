/*
  "Quanto você paga: Viva Nomads × Airbnb" — cálculo PURO do comparativo.
  Tudo vem de config/planos.ts (planos e referências de mercado).
*/
import { MERCADO, PLANOS, type PlanoId } from "../config/planos.ts";

export interface LinhaPlano {
  id: PlanoId;
  nome: string;
  /** Comissão: % de UM aluguel, uma vez por contrato. */
  comissao: number;
  /** Mensalidades do período (meses × preço). */
  mensalidades: number;
  total: number;
  /** Quanto o total representa do contrato inteiro (aluguel × meses). */
  pctDoContrato: number;
}

export interface Comparativo {
  aluguel: number;
  meses: number;
  valorContrato: number;
  airbnb: number;
  imobiliaria: number;
  planos: LinhaPlano[];
}

const dinheiro = (v: number) => Math.round(v * 100) / 100;

/** Um contrato de `meses` com aluguel `aluguel`: quanto o proprietário paga em cada opção. */
export function calcularComparativo(aluguel: number, meses: number): Comparativo {
  const a = Math.max(0, Number(aluguel) || 0);
  const m = Math.max(1, Math.round(Number(meses) || 1));
  const valorContrato = a * m;
  const planos = PLANOS.filter((p) => p.precoMensal !== null).map((p) => {
    const comissao = dinheiro(a * p.comissao);
    const mensalidades = dinheiro((p.precoMensal ?? 0) * m);
    const total = dinheiro(comissao + mensalidades);
    return { id: p.id, nome: p.nome, comissao, mensalidades, total, pctDoContrato: valorContrato ? total / valorContrato : 0 };
  });
  return {
    aluguel: a,
    meses: m,
    valorContrato,
    airbnb: dinheiro(valorContrato * MERCADO.airbnbTaxa),
    imobiliaria: dinheiro(a * MERCADO.imobiliariaPrimeiroAluguel + valorContrato * MERCADO.imobiliariaAdmMensal),
    planos,
  };
}

export interface CustoAnual {
  id: PlanoId;
  nome: string;
  /** null = o plano não comporta tantos imóveis. */
  total: number | null;
  sobConsulta: boolean;
}

/**
 * Qual plano compensa num ano: `imoveis` anunciados e `contratosAno` fechados
 * por ano, com aluguel médio `aluguel`. Custo = comissões + 12 mensalidades.
 * Plano com limite menor que `imoveis` não serve; o Gestor é sob consulta.
 */
export function custoAnualPorPlano(imoveis: number, contratosAno: number, aluguel: number): CustoAnual[] {
  const n = Math.max(1, Math.round(Number(imoveis) || 1));
  const c = Math.max(0, Math.round(Number(contratosAno) || 0));
  const a = Math.max(0, Number(aluguel) || 0);
  return PLANOS.map((p) => {
    if (p.precoMensal === null) return { id: p.id, nome: p.nome, total: null, sobConsulta: true };
    if (p.limiteAnuncios < n) return { id: p.id, nome: p.nome, total: null, sobConsulta: false };
    return { id: p.id, nome: p.nome, total: dinheiro(c * a * p.comissao + 12 * p.precoMensal), sobConsulta: false };
  });
}

/** O plano mais barato do cenário (ou "gestor" quando nenhum plano com preço comporta). */
export function planoMaisBarato(imoveis: number, contratosAno: number, aluguel: number): PlanoId {
  const opcoes = custoAnualPorPlano(imoveis, contratosAno, aluguel).filter((x) => x.total !== null) as (CustoAnual & { total: number })[];
  if (opcoes.length === 0) return "gestor";
  return opcoes.reduce((a, b) => (b.total < a.total ? b : a)).id;
}
