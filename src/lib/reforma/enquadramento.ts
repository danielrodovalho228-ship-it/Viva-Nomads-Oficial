/*
  E255 — REFORMA-ENQUADRAMENTO-A: "Você entra na regra nova?" no painel do dono (PURO). Atrás de chave DESLIGADA
  (NEXT_PUBLIC_ENQUADRAMENTO_REFORMA) até o parecer jurídico.
  Regra conferida (LC 214/2025 + Decreto 12.955/2026 art. 382; Resolução CGIBS 6/2026): a pessoa física passa a
  contribuir sobre a locação com MAIS DE 3 imóveis alugados E receita de locação ACIMA DE R$ 240 mil no ano anterior;
  ou, no próprio ano, acima de R$ 288 mil com mais de 3 imóveis.
  Aqui só se diz se os números informados passam ou não dos critérios. Nunca valor ou percentual de imposto,
  alíquota, redutor, comparação entre pessoa física e empresa, nem recomendação de abrir empresa.
*/

/** "Mais de 3 imóveis": a partir de 4. */
export const LIMITE_IMOVEIS = 3;
/** Receita de locação no ano anterior: acima de R$ 240 mil. */
export const LIMITE_RECEITA_ANO_ANTERIOR = 240_000;
/** Gatilho no próprio ano: acima de R$ 288 mil (com mais de 3 imóveis). */
export const GATILHO_ANO_CORRENTE = 288_000;

/** Limiares do AVISO (antes dos critérios, para chamar a conferência a tempo). */
export const AVISO_MIN_IMOVEIS = 3;
export const AVISO_MIN_RECEITA = 200_000;

export const TEXTO_AVISO = "A reforma tributária muda as regras para quem tem mais de 3 imóveis alugados. Confira se você entra.";
export const TEXTO_NAO_E_ORIENTACAO = "Isso não é orientação tributária. Fale com seu contador.";

/** O aviso aparece para quem tem 3 imóveis ou mais na Viva OU receita na Viva de R$ 200 mil ou mais no ano. */
export function mostrarAvisoReforma(p: { imoveisNaViva: number; receitaAnoNaViva: number }): boolean {
  return p.imoveisNaViva >= AVISO_MIN_IMOVEIS || p.receitaAnoNaViva >= AVISO_MIN_RECEITA;
}

const naoNegativo = (n: number | null | undefined) => (Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0);

export interface NumerosEnquadramento {
  /** Imóveis com contrato no ano, na Viva. */
  imoveisNaViva: number;
  /** Receita de locação na Viva no ano: registrada + projeção dos contratos assinados até 31/12. */
  receitaNaViva: number;
  /** Fora da Viva (informado só no navegador; nunca gravado nem enviado). */
  outrosImoveis?: number | null;
  outraReceita?: number | null;
}

export interface ResultadoEnquadramento {
  imoveis: number;
  receita: number;
  /** Passa dos dois critérios: mais de 3 imóveis E mais de R$ 240 mil. */
  passaCriterios: boolean;
  /** Passa pelo gatilho do próprio ano: mais de 3 imóveis E mais de R$ 288 mil. */
  passaGatilho: boolean;
}

export function enquadramento(n: NumerosEnquadramento): ResultadoEnquadramento {
  const imoveis = Math.round(naoNegativo(n.imoveisNaViva) + naoNegativo(n.outrosImoveis));
  const receita = naoNegativo(n.receitaNaViva) + naoNegativo(n.outraReceita);
  const maisDe3 = imoveis > LIMITE_IMOVEIS;
  return { imoveis, receita, passaCriterios: maisDe3 && receita > LIMITE_RECEITA_ANO_ANTERIOR, passaGatilho: maisDe3 && receita > GATILHO_ANO_CORRENTE };
}

/** As duas linhas do resultado, em texto. */
export function linhasDoResultado(r: ResultadoEnquadramento): { criterios: string; gatilho: string } {
  return {
    criterios: `Pelos números informados, você ${r.passaCriterios ? "passa" : "não passa"} dos dois critérios (mais de 3 imóveis E mais de R$ 240 mil).`,
    gatilho: `No próprio ano, a regra também vale acima de R$ 288 mil com mais de 3 imóveis: pelos números informados, você ${r.passaGatilho ? "passa" : "não passa"} por esse gatilho.`,
  };
}

/* ---------- Números da Viva (do próprio dono, montados no servidor) ---------- */

export interface ContratoParaEnquadramento {
  propertyId: string;
  status: string;
  blocos: { id: string; inicio: string; fim: string; valor: number }[];
  pagamentos: { blocoId: string | null; tipo: string; valor: number; dataPagamento: string }[];
}

export interface NumerosNaViva {
  ano: number;
  /** Imóveis com contrato no ano (algum bloco dentro do ano). */
  imoveisComContrato: number;
  /** Receita de locação registrada no ano (pagamentos de bloco). */
  receitaRegistrada: number;
  /** Projeção: blocos ainda não pagos de contratos assinados que começam até 31/12. */
  projecao: number;
}

export function numerosNaViva(contratos: readonly ContratoParaEnquadramento[], hojeISO: string): NumerosNaViva {
  const ano = Number(hojeISO.slice(0, 4));
  const ini = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  const vivos = contratos.filter((c) => c.status !== "cancelado");
  const imoveis = new Set<string>();
  let receitaRegistrada = 0;
  let projecao = 0;
  for (const c of vivos) {
    if (c.blocos.some((b) => b.inicio.slice(0, 10) <= fim && b.fim.slice(0, 10) >= ini)) imoveis.add(c.propertyId);
    const pagosNoAno = c.pagamentos.filter((p) => p.tipo === "aluguel" && p.dataPagamento.slice(0, 4) === String(ano));
    receitaRegistrada += pagosNoAno.reduce((s, p) => s + naoNegativo(p.valor), 0);
    if (c.status !== "ativo") continue;
    const blocosPagos = new Set(c.pagamentos.filter((p) => p.tipo === "aluguel" && p.blocoId).map((p) => p.blocoId));
    for (const b of c.blocos) {
      const inicio = b.inicio.slice(0, 10);
      if (!blocosPagos.has(b.id) && inicio >= hojeISO.slice(0, 10) && inicio <= fim) projecao += naoNegativo(b.valor);
    }
  }
  return { ano, imoveisComContrato: imoveis.size, receitaRegistrada, projecao };
}
