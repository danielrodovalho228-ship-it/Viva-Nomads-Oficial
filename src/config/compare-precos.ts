/*
  Seção "Compare" da página de preços (ordens 3914d70c e aa916ba9, item 6). Base JUSTA: percentual do
  total pago pelo morador, no formato típico de cada empresa (não valores em R$ de 3 meses). Contrato de
  exemplo: 3 meses de R$ 4.320 = R$ 12.960 (usada só no exemplo da Viva). Cada número de concorrente carrega FONTE e DATA;
  linha sem fonte conferida (`fonte === null`) NÃO é exibida ao público (exceto pela regra permanente
  do Daniel, ordem c6b62141: Viva × Airbnb × QuintoAndar sempre visíveis — QuintoAndar com fonte e nota) — texto
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
  /** Ressalva exibida junto da linha (ex.: percentual de referência a conferir na empresa). */
  nota?: string;
}

/** Contrato de 30 meses: 1 mês de entrada + `mensal` ao mês, dividido pelos 30 meses (QuintoAndar, imobiliária). */
const pctContrato30 = (mensal: number) => Math.round(((1 + 30 * mensal) / 30) * 1000) / 1000;

export const LINHAS_COMPARE: readonly LinhaCompare[] = [
  {
    id: "viva",
    nome: "Viva Nomads",
    regra: "12% sobre o valor total do contrato fechado (menor com mais imóveis), cobrado do proprietário. Sem mensalidade.",
    pct: Math.round(TAXA_COMISSAO_PADRAO * 1000) / 1000,
    fonte: { nome: "Página de preços da Viva Nomads", url: "/precos" },
    conferidoEm: "2026-10-10",
  },
  {
    id: "airbnb",
    nome: "Airbnb",
    regra: "Taxa de serviço de 16% sobre cada estadia para anfitriões no Brasil.",
    pct: 0.16,
    fonte: { nome: "Central de Ajuda do Airbnb — taxas de serviço (artigo 1857)", url: "https://www.airbnb.com.br/help/article/1857" },
    conferidoEm: "2026-10-10",
  },
  // Abaixo: valores informados pelo Daniel, SEM fonte pública conferida até aqui → ocultos.
  {
    id: "booking",
    nome: "Booking",
    regra: "Comissão de 18% sobre a estadia (programa Preferred Partner; a comissão padrão pode ser menor).",
    pct: 0.18,
    fonte: null,
    conferidoEm: null,
  },
  {
    id: "quintoandar",
    nome: "QuintoAndar",
    regra: "Contrato de 30 meses: 1 mês de entrada + 9,3% ao mês (mínimo de R$ 160).",
    pct: pctContrato30(0.093),
    // Ordem c6b62141 (Daniel): a comparação Viva × Airbnb × QuintoAndar fica SEMPRE na página.
    // O guia oficial confirma o modelo (mês de entrada + taxa mensal de administração); o percentual é
    // referência informada pela equipe — a nota abaixo diz isso ao público.
    fonte: { nome: "Guia oficial do QuintoAndar para anunciar", url: "https://www.quintoandar.com.br/guias/?p=2280099" },
    conferidoEm: "2026-10-14",
    nota: "Modelo de cobrança conforme o guia oficial; percentual de referência informado pela equipe — confira o vigente no QuintoAndar.",
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
  "Você só paga quando o contrato é fechado",
  "Contrato pronto, assinado na plataforma",
  "Chat com quem vai morar",
  "Avaliação dos dois lados",
  "Profissionais que ficam meses",
  "Sem contrato de 30 meses",
  "Sem faxina nem troca de morador toda semana",
  "Nenhuma taxa para quem vem morar",
];

/**
 * "Quanto fica de cada mês em cada canal" da Calculadora de ROI (prompt 27, item 2 — decisão do Daniel, prompt 15,
 * item 4): Viva, Airbnb (taxa com fonte) e o contrato tradicional (12+ meses) com a taxa de administração e a taxa
 * de contrato que a pessoa informou na própria tela. Sem QuintoAndar.
 */
export function canaisDaCalculadora(trad: { taxaAdm: number; intermediacaoACadaMeses: number }): LinhaCompare[] {
  const porId = (id: string) => LINHAS_COMPARE.find((l) => l.id === id && l.fonte !== null) as LinhaCompare;
  const adm = Math.min(1, Math.max(0, Number.isFinite(trad.taxaAdm) ? trad.taxaAdm : 0));
  const cada = Number.isFinite(trad.intermediacaoACadaMeses) ? trad.intermediacaoACadaMeses : 0;
  const pct = Math.round((adm + (cada > 0 ? 1 / cada : 0)) * 1000) / 1000;
  const admTxt = `${String(Math.round(adm * 1000) / 10).replace(".", ",")}%`;
  const tradicional: LinhaCompare = {
    id: "tradicional",
    nome: "Contrato tradicional (12+ meses)",
    regra: `Administração de ${admTxt} ao mês${cada > 0 ? ` + 1 valor mensal a cada ${cada} meses de contrato` : ""} (os números do contrato tradicional acima).`,
    pct,
    fonte: null,
    conferidoEm: null,
    nota: "Referência de mercado ajustável nesta tela — confira com a sua imobiliária.",
  };
  return [porId("viva"), porId("airbnb"), tradicional];
}

/** Só o que tem fonte e data conferidas aparece no site. */
export function linhasPublicas(): LinhaCompare[] {
  return LINHAS_COMPARE.filter((l) => l.fonte !== null && l.conferidoEm !== null);
}

/**
  Retorno do Airbnb em Uberlândia (ordem bd296d53, item 3): referência para o proprietário comparar sem
  expectativa inflada. Valores ao mês sobre o valor do imóvel. Não prometer "1–2% ao mês".
*/
export const RETORNO_AIRBNB_UBERLANDIA = {
  brutoMensalPct: 0.6,
  liquidoMensalMinPct: 0.1,
  liquidoMensalMaxPct: 0.4,
  fonte: "Airbtics e GuestFavorites, 2025–26",
  referencia: COMPARE_REFERENCIA,
  texto:
    "Em Uberlândia, o Airbnb rende cerca de 0,6% ao mês bruto e 0,1% a 0,4% ao mês líquido (Airbtics e GuestFavorites, 2025–26). Valores de referência de out/2026.",
} as const;
