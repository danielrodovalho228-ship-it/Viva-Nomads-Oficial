/*
  Seção "Compare" da página de preços (ordem 3914d70c, item 3). Contrato de exemplo:
  3 meses de R$ 4.320 = R$ 12.960. Cada número de concorrente carrega FONTE e DATA;
  linha sem fonte conferida (`fonte === null`) NÃO é exibida ao público — texto
  objetivo e verificável, nunca número "de ouvir falar". Sem logos de terceiros (só nomes).
  Para liberar uma linha: conferir na fonte oficial, preencher `fonte` e `conferidoEm`.
*/
import { TAXA_COMISSAO_PADRAO, valorTaxa } from "../lib/cobranca/regra.ts";

export const COMPARE_ALUGUEL = 4320;
export const COMPARE_MESES = 3;
export const COMPARE_CONTRATO = COMPARE_ALUGUEL * COMPARE_MESES; // 12.960
export const COMPARE_REFERENCIA = "out/2026";
export const COMPARE_RODAPE = `Valores de referência de ${COMPARE_REFERENCIA}, sujeitos a mudança pelas empresas. Exemplo ilustrativo.`;

export interface LinhaCompare {
  id: string;
  nome: string;
  /** Como a empresa cobra, em texto objetivo. */
  regra: string;
  /** Valor em R$ no exemplo; null quando não é um valor único (ex.: plano pago para anunciar). */
  valor: number | null;
  /** Fonte pública conferida (nome + endereço). null = ainda não conferida → linha oculta. */
  fonte: { nome: string; url: string } | null;
  conferidoEm: string | null; // "AAAA-MM-DD"
}

const pctDoContrato = (p: number) => Math.round(COMPARE_CONTRATO * p * 100) / 100;

export const LINHAS_COMPARE: readonly LinhaCompare[] = [
  {
    id: "viva",
    nome: "Viva Nomads",
    regra: "12% do primeiro aluguel de cada contrato e de cada renovação, cobrado do proprietário. Sem mensalidade.",
    valor: valorTaxa(COMPARE_ALUGUEL, TAXA_COMISSAO_PADRAO),
    fonte: { nome: "Página de preços da Viva Nomads", url: "/precos" },
    conferidoEm: "2026-10-10",
  },
  {
    id: "airbnb",
    nome: "Airbnb",
    regra: "Taxa de serviço de 16% do valor da reserva para anfitriões no Brasil, em todas as reservas.",
    valor: pctDoContrato(0.16),
    fonte: { nome: "Central de Ajuda do Airbnb — taxas de serviço (artigo 1857)", url: "https://www.airbnb.com.br/help/article/1857" },
    conferidoEm: "2026-10-10",
  },
  // Abaixo: valores informados pelo Daniel, SEM fonte pública conferida até aqui → ocultos.
  {
    id: "booking",
    nome: "Booking",
    regra: "Comissão de 18% sobre a reserva (programa Preferred Partner; a comissão padrão pode ser menor).",
    valor: pctDoContrato(0.18),
    fonte: null,
    conferidoEm: null,
  },
  {
    id: "quintoandar",
    nome: "QuintoAndar",
    regra: "Primeiro aluguel + 9,3% ao mês (mínimo de R$ 160), em contrato longo.",
    valor: null,
    fonte: null,
    conferidoEm: null,
  },
  {
    id: "imobiliaria",
    nome: "Imobiliária tradicional",
    regra: "Primeiro aluguel + 8% a 10% ao mês de administração.",
    valor: null,
    fonte: null,
    conferidoEm: null,
  },
  {
    id: "olx",
    nome: "OLX",
    regra: "Anúncio básico grátis; o proprietário faz triagem, contrato e cobrança sozinho.",
    valor: null,
    fonte: null,
    conferidoEm: null,
  },
  {
    id: "zap-vivareal",
    nome: "ZAP / Viva Real",
    regra: "Plano pago para anunciar, mesmo sem alugar.",
    valor: null,
    fonte: null,
    conferidoEm: null,
  },
];

/** Só o que tem fonte e data conferidas aparece no site. */
export function linhasPublicas(): LinhaCompare[] {
  return LINHAS_COMPARE.filter((l) => l.fonte !== null && l.conferidoEm !== null);
}
