/*
  E873 — as taxas da Viva na página /empresas, da FONTE ÚNICA (lib/cobranca/regra.ts): a empresa vê a mesma estrutura
  aprovada que o proprietário vê (12% · 10% · 8% · 6% e o Plano Gestor 4% a partir de 20 imóveis). Nada digitado à mão.
  A taxa é do PROPRIETÁRIO, por contrato fechado; quem vem morar (o time da empresa) não paga taxa à plataforma. PURO.
*/
import { FAIXAS_COMISSAO_PADRAO, pctTexto, rotuloFaixaTaxa, taxaPublicaTexto } from "./cobranca/regra.ts";

export interface LinhaTaxaEmpresa {
  faixa: string; // "1–2 imóveis", "20+ imóveis · Plano Gestor"
  taxa: string; // "12%"
  gestor: boolean;
}

export function linhasTaxaEmpresas(): LinhaTaxaEmpresa[] {
  return FAIXAS_COMISSAO_PADRAO.map((f) => ({ faixa: rotuloFaixaTaxa(f, true), taxa: taxaPublicaTexto(f), gestor: !!f.gestor }));
}

const COMUNS = FAIXAS_COMISSAO_PADRAO.filter((f) => !f.gestor);
const MAIOR = pctTexto(Math.max(...COMUNS.map((f) => f.taxa)));
const MENOR = pctTexto(Math.min(...COMUNS.map((f) => f.taxa)));
const GESTOR = FAIXAS_COMISSAO_PADRAO.find((f) => f.gestor)!;

/** A frase da taxa para a empresa (FAQ e seção de taxas). */
export const FRASE_TAXA_EMPRESAS =
  `A taxa de serviço da Viva é paga pelo proprietário, sobre o valor total do contrato fechado: de ${MAIOR} a ${MENOR}, ` +
  `menor para quem tem mais imóveis, e ${pctTexto(GESTOR.taxa)} no Plano Gestor (carteiras de ${GESTOR.minImoveis} ou mais imóveis). ` +
  `Quem vem morar não paga taxa à plataforma, e não há mensalidade.`;
