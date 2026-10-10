/*
  PREMISSAS FINANCEIRAS — fonte única de /simulacao e /roi (documentos internos
  dos sócios). Cada número tem valor, unidade e fonte. Para mudar a conta, mude
  aqui: as duas páginas e os testes leem este arquivo.

  Referência: out/2026. Dólar: R$ 5,20. Estimativas para decidir, não parecer
  contábil. Puro (sem alias "@"), para rodar no node --test.
*/
import { FAIXAS_COMISSAO_PADRAO, taxaMediaPonderada } from "../lib/cobranca/regra.ts";

export const REFERENCIA = "out/2026";
export const DOLAR = 5.2;

export interface Item {
  rotulo: string;
  valor: number;
  unidade: string;
  fonte?: string;
  obs?: string;
}

// ── Receita por contrato ────────────────────────────────────────────────────
/*
  Modelo único (Daniel, 10/10): taxa de serviço por contrato fechado (renovação = novo contrato), sobre o
  valor do PRIMEIRO mês. Sem mensalidade nesta fase (assinatura = fase 2, futuro, para donos com muitos
  imóveis, fora das projeções). Faixas em lib/cobranca/regra.ts (fonte única).
*/
/** Valor médio do primeiro mês de um contrato (R$) — o mesmo ticket do Compare. */
export const ALUGUEL_MEDIO = 4320;

/**
 * Parte dos contratos por faixa de imóveis do dono (mesma ordem de FAIXAS_COMISSAO_PADRAO).
 * Padrão: todos na 1ª faixa (1–2 imóveis, 12%), o caso típico do piloto.
 */
export const MIX_FAIXAS: readonly number[] = [1, 0, 0, 0, 0];

/** Taxa média ponderada pelas faixas (0..1). */
export const TAXA_MEDIA = taxaMediaPonderada(MIX_FAIXAS, FAIXAS_COMISSAO_PADRAO);

/** Cenários simples de contratos fechados por mês (ordem da vitrine: receita bruta da taxa). */
export const CONTRATOS_MES_CENARIOS = [10, 20, 40] as const;

// ── Custos variáveis por contrato ───────────────────────────────────────────
export const CUSTOS_POR_CONTRATO: Item[] = [
  { rotulo: "Identidade do inquilino (documento, prova de vida, rosto)", valor: 2, unidade: "R$/contrato", fonte: "https://didit.me/pricing", obs: "Didit ≈ US$ 0,33; 500 grátis/mês. CAF sob orçamento." },
  { rotulo: "Antifraude / consulta de CPF", valor: 0, unidade: "R$/contrato", obs: "Opcional, só no aceite: ≈ R$ 10 por consulta, sob orçamento." },
  { rotulo: "Assinatura eletrônica (contrato + termo de entrega)", valor: 6, unidade: "R$/contrato", fonte: "https://zapsign.co/plans-and-prices", obs: "≈ R$ 3 por documento além dos 50 do plano." },
  { rotulo: "Cobrança da taxa de serviço (Pix + aviso)", valor: 3, unidade: "R$/contrato", fonte: "https://www.asaas.com/precos-e-taxas", obs: "Pix R$ 1,99 + aviso R$ 0,99." },
  { rotulo: "Atendimento da Viva (IA)", valor: 5, unidade: "R$/contrato", fonte: "https://finout.io/blog/anthropic-api-pricing" },
];
/**
 * Imposto da Viva sobre TODA a receita (Simples Nacional). O anexo depende da
 * atividade cadastrada e da folha: a definir pelo contador na abertura do CNPJ.
 * Padrão 6% (faixa inicial); 15,5% se cair no anexo V.
 */
export const IMPOSTO_OPCOES = [0.06, 0.155] as const;
export const IMPOSTO_SOBRE_RECEITA = IMPOSTO_OPCOES[0];
export const IMPOSTO_TEXTO = "a definir pelo contador – anexo do Simples";
/** Operador local por contrato: R$ 0 (sócios fazem) ou R$ 100. */
export const OPERADOR_OPCOES = [0, 100] as const;

// ── Custos fixos por mês ────────────────────────────────────────────────────
export const CUSTOS_FIXOS: Item[] = [
  { rotulo: "Banco de dados (Supabase Pro, US$ 25)", valor: 130, unidade: "R$/mês", fonte: "https://supabase.com/pricing" },
  { rotulo: "Hospedagem (Vercel Pro, US$ 20)", valor: 105, unidade: "R$/mês", fonte: "https://vercel.com/pricing" },
  { rotulo: "Assinatura eletrônica (ZapSign Professional, 50 documentos)", valor: 105, unidade: "R$/mês", fonte: "https://zapsign.co/plans-and-prices" },
  { rotulo: "WhatsApp (Z-API)", valor: 99, unidade: "R$/mês", fonte: "https://www.tabnews.com.br/ivanamato/450a2559-aada-4aab-a8b7-a0af43cb3315" },
  { rotulo: "E-mails (Resend, grátis até 3.000/mês)", valor: 0, unidade: "R$/mês", fonte: "https://resend.com/pricing", obs: "Acima disso, US$ 20." },
  { rotulo: "IA fora dos contratos (textos, testes)", valor: 200, unidade: "R$/mês", obs: "Faixa R$ 100 a 300." },
  { rotulo: "Contador (Simples Nacional, sem funcionários)", valor: 250, unidade: "R$/mês", fonte: "https://contabilidade.com/blog/quanto-custa-a-contabilidade-online-em-2026-guia-de-precos-e-o-que-esta-incluso/", obs: "Faixa R$ 189 a 329." },
  { rotulo: "Apple Developer, domínio, certificado digital, e-mail próprio", valor: 100, unidade: "R$/mês" },
];
export const CUSTO_FIXO_FAIXA = { min: 989, max: 1450, texto: "R$ 989 a R$ 1.450 conforme o plano dos fornecedores" };

/** Marketing por mês: nada antes dos contratos, R$ 800 no ano 1, R$ 1.500 depois. */
export function marketingDoMes(m: number): number {
  if (m <= 3) return 0;
  return m <= 12 ? 800 : 1500;
}

/** Investimento único: jurídico, CNPJ, marca, Google Play, lançamento. */
export const INVESTIMENTO_INICIAL = 16000;

// ── Cenários (contratos começam no mês 4) ──────────────────────────────────
export type CenarioId = "pessimista" | "base" | "otimista";
export interface Cenario {
  id: CenarioId;
  nome: string;
  contratosIniciais: number;
  crescimentoMensal: number;
  teto: number;
  donosNovosMes: number;
}
export const MES_PRIMEIRO_CONTRATO = 4;
export const HORIZONTE_MESES = 36;
export const CENARIOS: Record<CenarioId, Cenario> = {
  pessimista: { id: "pessimista", nome: "Pessimista", contratosIniciais: 1, crescimentoMensal: 0.4, teto: 10, donosNovosMes: 2 },
  base: { id: "base", nome: "Base", contratosIniciais: 2, crescimentoMensal: 1, teto: 35, donosNovosMes: 5 },
  otimista: { id: "otimista", nome: "Otimista", contratosIniciais: 3, crescimentoMensal: 2.2, teto: 80, donosNovosMes: 10 },
};

// ── Receitas de parceiros (POTENCIAL: todas desligadas por padrão) ─────────
/*
  A receita BASE é só a taxa de serviço por contrato. Parceiros entram na mesma conta
  (com o imposto da Viva) apenas quando ligados na tela. Nenhum tem contrato
  assinado: é potencial, nunca receita garantida.

  Seguros: a Viva como REPRESENTANTE de seguros (Res. CNSP 431/2021) recebe um
  percentual do prêmio, ajustável de 0% a 15% (padrão 10%). Sem registro na
  SUSEP; não pode condicionar a locação ao seguro (venda casada).
*/

/** Duração média de um contrato (meses) — premissa para os prêmios mensais. A confirmar com os dados reais. */
export const MESES_MEDIOS_CONTRATO = 3;

export const REPRESENTANTE_SEGUROS = {
  min: 0,
  max: 0.15,
  padrao: 0.1,
  texto: "Viva como representante de seguros (Res. CNSP 431/2021)",
  aviso: "estimativa, sem contrato fechado com seguradora",
} as const;

export type ParceiroStatus = "sem parceiro" | "em conversa" | "em estudo";

export interface Parceiro {
  id: string;
  nome: string;
  /** "seguro": receita = prêmio × % do representante; "servico": receita fixa por unidade. */
  tipo: "seguro" | "servico";
  /** Seguro: prêmio por unidade (R$). Serviço: o que a Viva recebe por unidade (R$). */
  valorUnidade: number;
  /** Fração dos contratos que contratam (0..1). */
  adesao: number;
  unidadesPorContrato: number;
  /** Mês da projeção em que a receita começa (1..36). */
  mesInicio: number;
  status: ParceiroStatus;
  detalhe: string;
  fonte?: string;
}

export const PARCEIROS: Parceiro[] = [
  {
    id: "seguro_incendio",
    nome: "Seguro incêndio",
    tipo: "seguro",
    valorUnidade: 200,
    adesao: 0.3,
    unidadesPorContrato: 1,
    mesInicio: 9,
    status: "em conversa",
    detalhe: "Prêmio ≈ R$ 200. Em conversa com a i2B; a Chubb também é candidata.",
    fonte: "https://www.seguroviagem.srv.br/blog/quanto-custa-seguro-residencial/",
  },
  {
    id: "seguro_fianca",
    nome: "Seguro-fiança",
    tipo: "seguro",
    valorUnidade: Math.round((ALUGUEL_MEDIO * MESES_MEDIOS_CONTRATO) / 12),
    adesao: 0.1,
    unidadesPorContrato: 1,
    mesInicio: 9,
    status: "em estudo",
    detalhe: `Prêmio estimado ≈ 1 aluguel por ano, proporcional a ${MESES_MEDIOS_CONTRATO} meses. Chubb aceita temporada até 90 dias (com danos aos móveis). Alternativa à caução: uma garantia só.`,
  },
  {
    id: "seguro_danos",
    nome: "Seguro de danos ao imóvel",
    tipo: "seguro",
    valorUnidade: 69 * MESES_MEDIOS_CONTRATO,
    adesao: 0.1,
    unidadesPorContrato: 1,
    mesInicio: 9,
    status: "em estudo",
    detalhe: `EasyCover/Now Seguros: R$ 69 a R$ 118 por mês por imóvel (usamos R$ 69 × ${MESES_MEDIOS_CONTRATO} meses). Contratado pelo proprietário.`,
  },
  { id: "conferencia", nome: "Conferência de entrada e saída", tipo: "servico", valorUnidade: 25, adesao: 0.2, unidadesPorContrato: 2, mesInicio: 4, status: "sem parceiro", detalhe: "Entrada e saída." },
  { id: "fotografia", nome: "Fotografia", tipo: "servico", valorUnidade: 45, adesao: 0.1, unidadesPorContrato: 1, mesInicio: 4, status: "sem parceiro", detalhe: "Fotos do anúncio." },
  { id: "limpeza", nome: "Limpeza/manutenção", tipo: "servico", valorUnidade: 20, adesao: 0.1, unidadesPorContrato: 1, mesInicio: 6, status: "sem parceiro", detalhe: "Entre locações." },
  { id: "carro", nome: "Carro mensal (Nômade Drive)", tipo: "servico", valorUnidade: 50, adesao: 0.05, unidadesPorContrato: 1, mesInicio: 13, status: "em conversa", detalhe: "Indicação de aluguel mensal de carro." },
  { id: "mudanca", nome: "Mudança/frete", tipo: "servico", valorUnidade: 20, adesao: 0.05, unidadesPorContrato: 1, mesInicio: 6, status: "sem parceiro", detalhe: "Indicação." },
];

/** Receita do parceiro por contrato fechado (R$, antes do imposto). */
export function receitaParceiroPorContrato(p: Parceiro, pctSeguro: number = REPRESENTANTE_SEGUROS.padrao): number {
  const pct = Math.min(REPRESENTANTE_SEGUROS.max, Math.max(REPRESENTANTE_SEGUROS.min, pctSeguro));
  const porUnidade = p.tipo === "seguro" ? p.valorUnidade * pct : p.valorUnidade;
  return porUnidade * p.adesao * p.unidadesPorContrato;
}

/** Selo fixo da visão do investidor. */
export const SELO_POTENCIAL = "Potencial — parcerias sem contrato assinado não são receita garantida";
