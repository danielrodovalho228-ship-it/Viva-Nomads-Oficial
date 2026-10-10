/*
  Seção "Compare" da página de preços (ordens 3914d70c e aa916ba9, item 6). Base JUSTA: percentual do
  total pago pelo morador, no formato típico de cada empresa (não valores em R$ de 3 meses). Reserva de
  exemplo: 3 meses de R$ 4.320 = R$ 12.960 (usada só no exemplo da Viva). Cada número de concorrente carrega FONTE e DATA;
  linha sem fonte conferida (`fonte === null`) NÃO é exibida ao público — texto
  objetivo e verificável, nunca número "de ouvir falar". Sem logos de terceiros (só nomes).
  Para liberar uma linha: conferir na fonte oficial, preencher `fonte` e `conferidoEm`.
*/
import { TAXA_COMISSAO_PADRAO } from "../lib/cobranca/regra.ts";

export const COMPARE_ALUGUEL = 4320;
export const COMPARE_MESES = 3;
export const COMPARE_CONTRATO = COMPARE_ALUGUEL * COMPARE_MESES; // 12.960
export const COMPARE_REFERENCIA = "out/2026";
export const COMPARE_RODAPE = `Valores de referência de ${COMPARE_REFERENCIA}, sujeitos a mudança pelas empresas. Cálculo ilustrativo.`;

export interface LinhaCompare {
  id: string;
  nome: string;
  /** Como a empresa cobra, em texto objetivo. */
  regra: string;
  /** Percentual do total pago pelo morador (0..1); null quando não é um percentual único (ex.: plano pago para anunciar). */
  pct: number | null;
  /** Fonte pública conferida (nome + endereço). null = ainda não conferida → linha oculta. */
  fonte: { nome: string; url: string } | null;
  conferidoEm: string | null; // "AAAA-MM-DD"
}

/** Contrato de 30 meses: 1 mês de entrada + `mensal` ao mês, dividido pelos 30 meses (QuintoAndar, imobiliária). */
const pctContrato30 = (mensal: number) => Math.round(((1 + 30 * mensal) / 30) * 1000) / 1000;

export const LINHAS_COMPARE: readonly LinhaCompare[] = [
  {
    id: "viva",
    nome: "Viva Nomads",
    regra: "12% de um mês por contrato fechado (≈ 4% numa reserva de 3 meses; menor com mais imóveis), cobrado do proprietário. Sem mensalidade.",
    pct: Math.round((TAXA_COMISSAO_PADRAO / COMPARE_MESES) * 1000) / 1000,
    fonte: { nome: "Página de preços da Viva Nomads", url: "/precos" },
    conferidoEm: "2026-10-10",
  },
  {
    id: "airbnb",
    nome: "Airbnb",
    regra: "Taxa de serviço de 16% do valor da reserva para anfitriões no Brasil, em todas as reservas.",
    pct: 0.16,
    fonte: { nome: "Central de Ajuda do Airbnb — taxas de serviço (artigo 1857)", url: "https://www.airbnb.com.br/help/article/1857" },
    conferidoEm: "2026-10-10",
  },
  // Abaixo: valores informados pelo Daniel, SEM fonte pública conferida até aqui → ocultos.
  {
    id: "booking",
    nome: "Booking",
    regra: "Comissão de 18% sobre a reserva (programa Preferred Partner; a comissão padrão pode ser menor).",
    pct: 0.18,
    fonte: null,
    conferidoEm: null,
  },
  {
    id: "quintoandar",
    nome: "QuintoAndar",
    regra: "Contrato de 30 meses: 1 mês de entrada + 9,3% ao mês (mínimo de R$ 160).",
    pct: pctContrato30(0.093),
    fonte: null,
    conferidoEm: null,
  },
  {
    id: "imobiliaria",
    nome: "Imobiliária tradicional",
    regra: "Contrato de 30 meses: 1 mês de entrada + cerca de 10% ao mês de administração.",
    pct: pctContrato30(0.1),
    fonte: null,
    conferidoEm: null,
  },
  {
    id: "olx",
    nome: "OLX",
    regra: "Anúncio básico grátis; o proprietário faz triagem, contrato e cobrança sozinho.",
    pct: null,
    fonte: null,
    conferidoEm: null,
  },
  {
    id: "zap-vivareal",
    nome: "ZAP / Viva Real",
    regra: "Plano pago para anunciar, mesmo sem alugar.",
    pct: null,
    fonte: null,
    conferidoEm: null,
  },
];

/**
  Diferenciais da Viva (ordem 5faa3903, item 3). Só a coluna da Viva é publicada: afirmar ✓/✗ de
  concorrente exige fonte pública conferida, como nas linhas de preço acima. Para liberar a matriz
  Viva × OLX × ZAP × Airbnb × QuintoAndar, conferir cada célula na fonte oficial e acrescentar a
  coluna com `fonte` e `conferidoEm`.
*/
export const DIFERENCIAIS_VIVA: readonly string[] = [
  "Você só paga quando a reserva é fechada",
  "Contrato pronto, assinado na plataforma",
  "Chat com quem vai morar",
  "Avaliação dos dois lados",
  "Profissionais que ficam meses",
  "Sem contrato de 30 meses",
  "Sem faxina nem check-in toda semana",
  "Nenhuma taxa para quem vem morar",
];

/** Só o que tem fonte e data conferidas aparece no site. */
export function linhasPublicas(): LinhaCompare[] {
  return LINHAS_COMPARE.filter((l) => l.fonte !== null && l.conferidoEm !== null);
}
