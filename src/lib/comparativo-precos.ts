/*
  "Quanto você paga: Viva Nomads × Airbnb" — cálculo PURO do comparativo.
  Tudo vem de config/planos.ts (planos e referências de mercado).
*/
import { GESTOR_PRECO, MERCADO, PLANOS, assinaturaAnualGestor, type PlanoId } from "../config/planos.ts";

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
  /** null = o plano não serve para tantos imóveis. */
  total: number | null;
  /** Gestor desligado em config (GESTOR_PRECO.ligado = false). */
  sobConsulta: boolean;
  /** Anúncios ativos permitidos (config/planos.ts). */
  limite: number;
  /** Mínimo de imóveis para o plano entrar na conta (só o Gestor tem). */
  minimo: number;
  /** false = fora da faixa do plano: aparece desabilitado e nunca "compensa". */
  disponivel: boolean;
}

/** "Limite de 1 anúncio" / "Limite de 5 anúncios". */
export function textoLimite(limite: number): string {
  return `Limite de ${limite} ${limite === 1 ? "anúncio" : "anúncios"}`;
}

/** Por que o plano está desabilitado: "Limite de 5 anúncios" / "A partir de 20 imóveis". */
export function textoIndisponivel(c: Pick<CustoAnual, "limite" | "minimo">, imoveis: number): string {
  return imoveis < c.minimo ? `A partir de ${c.minimo} imóveis` : textoLimite(c.limite);
}

/**
 * Qual plano compensa num ano: `imoveis` anunciados e `contratosAno` fechados
 * no total, com aluguel médio `aluguel`. Custo = assinatura anual + comissões
 * (uma por contrato, sobre 1 aluguel). Com locações por imóvel:
 * contratosAno = locações × imóveis. Plano fora da faixa (limite de anúncios
 * ou mínimo do Gestor) não serve.
 */
export function custoAnualPorPlano(imoveis: number, contratosAno: number, aluguel: number): CustoAnual[] {
  const n = Math.max(1, Math.round(Number(imoveis) || 1));
  const c = Math.max(0, Math.round(Number(contratosAno) || 0));
  const a = Math.max(0, Number(aluguel) || 0);
  return PLANOS.map((p) => {
    const gestor = p.id === "gestor";
    const minimo = gestor ? GESTOR_PRECO.minimoImoveis : 1;
    const base = { id: p.id, nome: p.nome, limite: p.limiteAnuncios, minimo, disponivel: p.limiteAnuncios >= n && n >= minimo };
    if (!base.disponivel) return { ...base, total: null, sobConsulta: false };
    const assinatura = gestor ? (GESTOR_PRECO.ligado ? assinaturaAnualGestor(n) : null) : (p.precoMensal ?? 0) * 12;
    if (assinatura === null) return { ...base, total: null, sobConsulta: true };
    return { ...base, total: dinheiro(c * a * p.comissao + assinatura), sobConsulta: false };
  });
}

/**
 * O plano mais barato do cenário. Empate: fica o plano mais simples (o
 * primeiro da tabela). Nenhum plano com preço → "gestor" (sob consulta).
 */
export function planoMaisBarato(imoveis: number, contratosAno: number, aluguel: number): PlanoId {
  const opcoes = custoAnualPorPlano(imoveis, contratosAno, aluguel).filter((x) => x.disponivel && x.total !== null) as (CustoAnual & { total: number })[];
  if (opcoes.length === 0) return "gestor";
  return opcoes.reduce((a, b) => (b.total < a.total ? b : a)).id;
}

/** Airbnb no ano, por imóvel: taxa do Airbnb (MERCADO) × aluguel × meses × locações. */
export function airbnbPorImovelAno(aluguel: number, meses: number, locacoes: number): number {
  return dinheiro(Math.max(0, aluguel) * Math.max(0, meses) * Math.max(0, locacoes) * MERCADO.airbnbTaxa);
}

export interface PontoCusto {
  imoveis: number;
  /** Custo do plano no ano dividido pelos imóveis. */
  porImovel: number;
}

export interface SerieCustoPorImovel {
  ate: number;
  planos: { id: PlanoId; nome: string; pontos: PontoCusto[] }[];
  /** Linha tracejada: Airbnb por imóvel no ano (não depende da quantidade). */
  airbnb: number;
  /** Onde Essencial e Profissional empatam (imóveis, fracionário), se cair na faixa dos dois. */
  empateEssencialPro: number | null;
}

/**
 * Gráfico "Custo por imóvel no ano" (1 a `ate` imóveis): uma linha por plano,
 * só onde o plano serve; Airbnb tracejado; marcador do empate Essencial × Pro.
 */
export function serieCustoPorImovel(aluguel: number, meses: number, locacoes: number, ate = 20): SerieCustoPorImovel {
  const l = Math.max(0, Math.round(Number(locacoes) || 0));
  const planos = PLANOS.map((p) => ({ id: p.id, nome: p.nome, pontos: [] as PontoCusto[] }));
  for (let n = 1; n <= ate; n++) {
    for (const c of custoAnualPorPlano(n, l * n, aluguel)) {
      if (c.disponivel && c.total !== null) planos.find((x) => x.id === c.id)!.pontos.push({ imoveis: n, porImovel: dinheiro(c.total / n) });
    }
  }
  const ess = PLANOS.find((p) => p.id === "essential")!;
  const pro = PLANOS.find((p) => p.id === "pro")!;
  const porImovelComissao = (ess.comissao - pro.comissao) * Math.max(0, aluguel) * l;
  const empate = porImovelComissao > 0 ? ((pro.precoMensal ?? 0) * 12 - (ess.precoMensal ?? 0) * 12) / porImovelComissao : Infinity;
  return {
    ate,
    planos: planos.filter((p) => p.pontos.length > 0),
    airbnb: airbnbPorImovelAno(aluguel, meses, l),
    empateEssencialPro: empate >= 1 && empate <= Math.min(ess.limiteAnuncios, ate) ? Math.round(empate * 100) / 100 : null,
  };
}
