/*
  Conteúdo da página /precos (prompt 13, revisão 3S). Puro (node --test).
  - Todo número vem de src/lib/cobranca/regra.ts (fonte única das faixas) ou de src/lib/faixas.ts (Caução).
  - Grades sempre em número PAR (regra do site).
  - "Compare": a Viva compete com os canais de estadias curtas (decisão do Daniel, 17/10): Viva, Airbnb,
    Booking.com e anúncio por conta própria. Percentual de concorrente só com fonte oficial e data; sem
    fonte, o texto diz "varia por contrato" e não mostra número.
*/
import { FAIXAS_COMISSAO_PADRAO, TAXA_COMISSAO_PADRAO, pctTexto } from "./cobranca/regra.ts";
import { LINHAS_COMPARE, type LinhaCompare } from "../config/compare-precos.ts";

const TAXA_MINIMA = Math.min(...FAIXAS_COMISSAO_PADRAO.map((f) => f.taxa));

export const DESTAQUES_PRECOS: readonly { n: string; t: string }[] = [
  { n: "R$ 0", t: "para anunciar" },
  { n: pctTexto(TAXA_COMISSAO_PADRAO), t: "só com contrato fechado" },
  { n: `até ${pctTexto(TAXA_MINIMA)}`, t: "com mais imóveis" },
  { n: "R$ 0", t: "para quem vem morar" },
];

/** As 3 frases curtas do bloco "Quanto mais imóveis, menor a taxa". */
export const FRASES_REGRA: readonly string[] = [
  "Você só paga quando o contrato é fechado.",
  "A taxa é sobre o valor total do contrato, uma vez por contrato ou renovação.",
  "Quem vem morar não paga nada à plataforma.",
];

export interface CaixaPrecos {
  titulo: string;
  texto: string;
  /** Foto do banco aprovado, única no site (t112). null = ainda não chegou; a caixa fica só com texto. */
  foto: string | null;
  alt?: string;
}

/** "Incluído em todo contrato" (antes "Incluído em toda locação"). */
export const INCLUIDO_CONTRATO: readonly CaixaPrecos[] = [
  { titulo: "Contrato assinado digitalmente", texto: "De 30 a 180 dias, com validade jurídica.", foto: null },
  { titulo: "Conversa registrada", texto: "Negociação na plataforma, com o contato protegido até o aceite.", foto: null },
  { titulo: "Valor mensal direto ao proprietário", texto: "A plataforma não recebe nem retém o valor mensal.", foto: null },
  { titulo: "Conferência de entrada e saída com fotos", texto: "Estado do imóvel registrado pelas duas partes, no começo e no fim da estadia.", foto: null },
];

export interface Opcional {
  titulo: string;
  texto: string;
  status: string;
  ok: boolean;
  href: string;
}

/** "Se você precisar": 4 opcionais, só o que existe no produto. O texto da Caução vem de CAUCAO_FRASE na página. */
export const OPCIONAIS_PRECOS = (caucaoFrase: string): readonly Opcional[] => [
  { titulo: "Caução", texto: `${caucaoFrase} Devolvida ao fim da estadia.`, status: "Disponível", ok: true, href: "/como-funciona#garantias" },
  { titulo: "Outras modalidades", texto: "Outras modalidades de garantia locatícia: em breve. A plataforma não é a garantidora.", status: "Em breve", ok: false, href: "/como-funciona#garantias" },
  { titulo: "Fotografia profissional", texto: "Sessão de fotos do imóvel com parceiro, sob consulta.", status: "Via parceiro", ok: false, href: "/parceiros/fotografos" },
  {
    titulo: "Limpeza durante a estadia",
    texto: "O proprietário pode incluir limpezas por mês no anúncio, com a quantidade e o valor claros antes do contrato.",
    status: "Disponível",
    ok: true,
    href: "/para-proprietarios",
  },
];

export const SUBTITULO_OPCIONAIS = "Opcionais, contratados no momento certo do fluxo. Caução: uma por contrato, combinada entre proprietário e morador.";

export interface CartaoCompare {
  id: "viva" | "airbnb" | "booking" | "proprio";
  nome: string;
  /** Percentual do total pago pelo morador; null = sem número publicado (sem fonte oficial ou não é percentual). */
  pct: number | null;
  regra: string;
  fonte: { nome: string; url: string } | null;
  conferidoEm: string | null;
}

const linha = (id: string): LinhaCompare => LINHAS_COMPARE.find((l) => l.id === id)!;

/**
 * Os 4 cartões do "Compare". Viva e Airbnb vêm de config/compare-precos.ts (com fonte e data). Booking.com:
 * sem página oficial pública com o percentual para o Brasil (a comissão fica no contrato de cada parceiro),
 * então NÃO mostra número. Anúncio por conta própria: custo em tempo e risco, sem percentual inventado.
 */
export function cartoesCompare(): CartaoCompare[] {
  const viva = linha("viva");
  const airbnb = linha("airbnb");
  return [
    { id: "viva", nome: viva.nome, pct: viva.pct, regra: viva.regra, fonte: viva.fonte, conferidoEm: viva.conferidoEm },
    { id: "airbnb", nome: airbnb.nome, pct: airbnb.pct, regra: airbnb.regra, fonte: airbnb.fonte, conferidoEm: airbnb.conferidoEm },
    {
      id: "booking",
      nome: "Booking.com",
      pct: null,
      regra: "Cobra um percentual de cada estadia; o valor varia por contrato (tipo de imóvel e programa do parceiro).",
      fonte: null,
      conferidoEm: null,
    },
    {
      id: "proprio",
      nome: "Anúncio por conta própria (OLX/redes)",
      pct: null,
      regra: "Sem taxa de plataforma, mas você cuida sozinho da triagem, do contrato, da cobrança e do risco de golpe.",
      fonte: null,
      conferidoEm: null,
    },
  ];
}
