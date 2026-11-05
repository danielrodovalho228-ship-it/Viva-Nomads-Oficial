/*
  PREMISSAS FINANCEIRAS — fonte única de /simulacao e /roi (documentos internos
  dos sócios). Cada número tem valor, unidade e fonte. Para mudar a conta, mude
  aqui: as duas páginas e os testes leem este arquivo.

  Referência: modelo de custos v2 (04/11/2026, E559). Dólar: R$ 5,20. Estimativas
  para decidir, não parecer contábil. Puro (sem alias "@"), para rodar no node --test.
*/
import { FAIXAS_COMISSAO_PADRAO, taxaMediaPonderada } from "../lib/cobranca/regra.ts";

export const REFERENCIA = "04/11/2026";
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
  valor TOTAL do contrato (aluguel × meses; ordem do Daniel, 14/10). Sem cobrança recorrente: E564 (04/11/2026) tirou a
  assinatura do Gestor (valor fixo por mês com imóveis incluídos, valor por extra e taxa zero) — o Gestor é a faixa de 4%
  a partir de GESTOR_PRECO.minimoImoveis imóveis ativos, ou conta de administradora. Valor mínimo mensal é fase 2, fora das projeções. Faixas em
  lib/cobranca/regra.ts (fonte única).
*/
/** Aluguel mensal médio de um contrato (R$) — o mesmo ticket do Compare. A taxa incide sobre ele × MESES_MEDIOS_CONTRATO. */
export const ALUGUEL_MEDIO = 4320;

/**
 * Parte dos contratos por faixa de imóveis do dono (mesma ordem de FAIXAS_COMISSAO_PADRAO: 12%, 10%, 8%, 6% e o
 * Plano Gestor a 4%). Padrão: todos na 1ª faixa (1–2 imóveis, 12%), o caso típico do piloto.
 */
export const MIX_FAIXAS: readonly number[] = [1, 0, 0, 0, 0];

/** Taxa média ponderada pelas faixas (0..1). */
export const TAXA_MEDIA = taxaMediaPonderada(MIX_FAIXAS, FAIXAS_COMISSAO_PADRAO);

/** Duração média de um contrato (meses) — premissa para os prêmios mensais. A confirmar com os dados reais. */
export const MESES_MEDIOS_CONTRATO = 3;

/** Cenários simples de contratos fechados por mês (ordem da vitrine: receita bruta da taxa). */
export const CONTRATOS_MES_CENARIOS = [10, 20, 40] as const;

// ── Custos variáveis por contrato ───────────────────────────────────────────
/*
  E559 (modelo de custos v2, 04/11/2026). A verificação de identidade é custo da Viva (obrigatória no fluxo) e NUNCA
  vira receita. A Certta ainda não foi cotada: R$ 20 por verificação é HIPÓTESE, rotulada assim em toda tela.
*/
/** Verificações de identidade por contrato fechado (hipótese do modelo v2). */
export const VERIFICACOES_POR_CONTRATO = 1.7;
/** Custo por verificação de identidade (Certta) — hipótese, preço a cotar. */
export const CUSTO_IDENTIDADE_HIPOTESE = 20;
export const ROTULO_HIPOTESE_IDENTIDADE = "hipótese — preço a cotar";
/** Taxa de serviço média por contrato (R$) — base da cobrança no cartão. */
const TAXA_POR_CONTRATO = ALUGUEL_MEDIO * MESES_MEDIOS_CONTRATO * TAXA_MEDIA;
const cent = (v: number) => Math.round(v * 100) / 100;

export const CUSTOS_POR_CONTRATO: Item[] = [
  {
    rotulo: "Identidade (Certta: documento, prova de vida, rosto)",
    valor: cent(VERIFICACOES_POR_CONTRATO * CUSTO_IDENTIDADE_HIPOTESE),
    unidade: "R$/contrato",
    obs: `${String(VERIFICACOES_POR_CONTRATO).replace(".", ",")} verificações por contrato × R$ ${CUSTO_IDENTIDADE_HIPOTESE} (${ROTULO_HIPOTESE_IDENTIDADE}). Custo da Viva, nunca receita.`,
  },
  { rotulo: "Antifraude / consulta de CPF", valor: 0, unidade: "R$/contrato", obs: "Opcional, só no aceite: ≈ R$ 10 por consulta, sob orçamento." },
  { rotulo: "Assinatura eletrônica (contrato + termo de entrega)", valor: 5, unidade: "R$/contrato", fonte: "https://zapsign.co/plans-and-prices", obs: "R$ 2,50 por documento além dos 20 do plano (2 documentos por contrato)." },
  {
    rotulo: "Cobrança da taxa de serviço (cartão)",
    valor: cent(TAXA_POR_CONTRATO * 0.0299 + 0.49),
    unidade: "R$/contrato",
    fonte: "https://www.asaas.com/precos-e-taxas",
    obs: "2,99% + R$ 0,49 sobre a taxa do contrato médio (Pix R$ 1,99).",
  },
  { rotulo: "Atendimento da Viva (IA)", valor: 5, unidade: "R$/contrato", fonte: "https://finout.io/blog/anthropic-api-pricing", obs: "Estimativa; o custo em produção é a medir." },
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
/* E559: fornecedores do modelo de custos v2 (04/11/2026) ≈ R$ 1.303/mês; o pró-labore é referência para projeção. */
export const CUSTOS_FIXOS: Item[] = [
  { rotulo: "Contabilidade (A2)", valor: 450, unidade: "R$/mês" },
  { rotulo: "CRECI pessoa jurídica (anuidade)", valor: 145.5, unidade: "R$/mês", obs: "≈ R$ 145,50 por mês." },
  { rotulo: "CRECI pessoa física (anuidade)", valor: 66.67, unidade: "R$/mês", obs: "≈ R$ 66,67 por mês." },
  { rotulo: "Assinatura eletrônica (ZapSign Equipe, 20 documentos)", valor: 69.9, unidade: "R$/mês", fonte: "https://zapsign.co/plans-and-prices" },
  { rotulo: "Certificado digital (e-CNPJ)", valor: 17, unidade: "R$/mês", obs: "≈ R$ 17 por mês." },
  { rotulo: "Domínios", valor: 10.83, unidade: "R$/mês", obs: "≈ R$ 10,83 por mês." },
  { rotulo: "Apple Developer", valor: 43, unidade: "R$/mês", obs: "≈ R$ 43 por mês." },
  { rotulo: "Infraestrutura (Vercel + Supabase + Resend + Expo, com IOF)", valor: 500, unidade: "R$/mês", obs: "≈ R$ 500 por mês." },
  { rotulo: "Emissor de NFS-e", valor: 0, unidade: "R$/mês", obs: "a cotar" },
  { rotulo: "Alvará de funcionamento", valor: 0, unidade: "R$/mês", obs: "a cotar" },
  { rotulo: "Pró-labore dos sócios", valor: 6000, unidade: "R$/mês", obs: "referência para projeção — não é decisão" },
];
/** Fornecedores (sem o pró-labore) — o mínimo do controle deslizante. */
export const CUSTO_FORNECEDORES = cent(CUSTOS_FIXOS.filter((c) => c.rotulo !== "Pró-labore dos sócios").reduce((s, c) => s + c.valor, 0));
/** Fora do fixo: o WhatsApp (Z-API) só entra se for ligado. */
export const FORA_DO_FIXO = ["WhatsApp (Z-API): a cotar, se for ligado"] as const;
/** Custo fixo ≈ R$ 7,3 mil/mês (fornecedores ≈ R$ 1.303 + pró-labore de referência R$ 6.000). O controle vai de só fornecedores até R$ 10 mil. */
export const CUSTO_FIXO_FAIXA = { min: CUSTO_FORNECEDORES, max: 10000, texto: "≈ R$ 7,3 mil/mês com pró-labore de referência" };

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
  /** Prêmio que depende da duração do contrato: prêmio = baseMensal × meses do contrato (a mesma premissa da tela). */
  premioPorMes?: number;
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
    premioPorMes: ALUGUEL_MEDIO / 12,
    adesao: 0.1,
    unidadesPorContrato: 1,
    mesInicio: 9,
    status: "em estudo",
    detalhe: `Prêmio estimado ≈ 1 aluguel por ano, proporcional a ${MESES_MEDIOS_CONTRATO} meses. Chubb aceita estadias de até 90 dias (com danos aos móveis). Alternativa à caução: uma garantia só.`,
  },
  {
    id: "seguro_danos",
    nome: "Seguro de danos ao imóvel",
    tipo: "seguro",
    valorUnidade: 69 * MESES_MEDIOS_CONTRATO,
    premioPorMes: 69,
    adesao: 0.1,
    unidadesPorContrato: 1,
    mesInicio: 9,
    status: "em estudo",
    detalhe: `EasyCover/Now Seguros: R$ 69 a R$ 118 por mês por imóvel (usamos R$ 69 × ${MESES_MEDIOS_CONTRATO} meses). Contratado pelo proprietário.`,
  },
  { id: "conferencia", nome: "Conferência de entrada e saída", tipo: "servico", valorUnidade: 25, adesao: 0.2, unidadesPorContrato: 2, mesInicio: 4, status: "sem parceiro", detalhe: "Entrada e saída." },
  { id: "fotografia", nome: "Fotografia", tipo: "servico", valorUnidade: 45, adesao: 0.1, unidadesPorContrato: 1, mesInicio: 4, status: "sem parceiro", detalhe: "Fotos do anúncio." },
  { id: "limpeza", nome: "Limpeza/manutenção", tipo: "servico", valorUnidade: 20, adesao: 0.1, unidadesPorContrato: 1, mesInicio: 6, status: "sem parceiro", detalhe: "Entre locações." },
  { id: "mudanca", nome: "Mudança/frete", tipo: "servico", valorUnidade: 20, adesao: 0.05, unidadesPorContrato: 1, mesInicio: 6, status: "sem parceiro", detalhe: "Indicação." },
];

/** Valor por unidade do parceiro para a duração do contrato (seguros proporcionais aos meses). */
export function valorUnidadeParceiro(p: Parceiro, meses: number = MESES_MEDIOS_CONTRATO): number {
  if (p.premioPorMes === undefined || meses === MESES_MEDIOS_CONTRATO) return p.valorUnidade;
  return Math.round(p.premioPorMes * meses);
}

/** Receita do parceiro por contrato fechado (R$, antes do imposto). */
export function receitaParceiroPorContrato(p: Parceiro, pctSeguro: number = REPRESENTANTE_SEGUROS.padrao, meses: number = MESES_MEDIOS_CONTRATO): number {
  const pct = Math.min(REPRESENTANTE_SEGUROS.max, Math.max(REPRESENTANTE_SEGUROS.min, pctSeguro));
  const valor = valorUnidadeParceiro(p, meses);
  const porUnidade = p.tipo === "seguro" ? valor * pct : valor;
  return porUnidade * p.adesao * p.unidadesPorContrato;
}

/** Selo fixo da visão do investidor. */
export const SELO_POTENCIAL = "Potencial — parcerias sem contrato assinado não são receita garantida";

// ── Receitas adicionais: produtos da Viva (prompt 21, decisão do Daniel em 18/10) ─────
/*
  Regra que fica: taxa de serviço de 12/10/8/6% sobre o valor total do contrato; inquilino SEM taxa obrigatória.
  Receitas extras aprovadas para ESTUDO (meta: + R$ 100 a 300 por contrato): todas desligadas por padrão, selo
  "Potencial". As que dependem do parecer da Dra. Beatriz levam "aguarda parecer jurídico" (ordem 6f1b553a).
  Números são premissas (sem fonte de mercado): editáveis na tela.
*/
export type GrupoReceita = "seguros" | "servicos" | "produtos";
export const GRUPOS_RECEITA: { id: GrupoReceita; nome: string }[] = [
  { id: "seguros", nome: "Seguros" },
  { id: "servicos", nome: "Serviços de parceiros" },
  { id: "produtos", nome: "Produtos da Viva" },
];
export const SELO_PARECER = "aguarda parecer jurídico";

export type ReceitaAdicionalId = "verificacao_inquilino" | "b2b_alocacao" | "publicamos_pago" | "ferramentas_fora" | "fundadores";
export interface ReceitaAdicional {
  id: ReceitaAdicionalId;
  nome: string;
  /** Valor da unidade (R$). Fundadores: a taxa que os fundadores pagam (0..1). */
  valor: number;
  unidade: string;
  /** Adesão (0..1) — a base muda por fonte (ver `base`). */
  adesao: number;
  /** Sobre o quê a adesão incide. */
  base: "contratos" | "donos_novos" | "donos_ativos";
  mesInicio: number;
  status: "em estudo" | "aguarda parecer";
  aguardaParecer: boolean;
  /** Receita (ou desconto, no caso dos fundadores). */
  natureza: "receita" | "desconto";
  obs: string;
}

/** Verificação paga do inquilino: candidatos verificados por contrato fechado e custo da CAF por verificação. */
export const VERIFICACAO = { candidatosPorContrato: 2, custoCaf: CUSTO_IDENTIDADE_HIPOTESE, custoCafTexto: ROTULO_HIPOTESE_IDENTIDADE } as const;
/** Ferramentas fora da Viva: saída mensal da base de donos ativos. */
export const SAIDA_DONOS_MES = 0.03;
/** Fundadores: quantos donos e por quantos meses pagam a taxa reduzida. */
export const FUNDADORES_REGRA = { donos: 50, meses: 6 } as const;

export const RECEITAS_ADICIONAIS: ReceitaAdicional[] = [
  {
    id: "verificacao_inquilino",
    nome: "Verificação paga e opcional do inquilino",
    valor: 44,
    unidade: "R$ por verificação",
    adesao: 0.4,
    base: "contratos",
    mesInicio: 6,
    status: "aguarda parecer",
    aguardaParecer: true,
    natureza: "receita",
    obs: `Opcional, nunca condição para alugar. ${VERIFICACAO.candidatosPorContrato} candidatos por contrato fechado; menos o custo da CAF (R$ ${VERIFICACAO.custoCaf} por verificação, ${VERIFICACAO.custoCafTexto}).`,
  },
  {
    id: "b2b_alocacao",
    nome: "Empresas (alocação de funcionários)",
    valor: 300,
    unidade: "R$ por pessoa alocada",
    adesao: 0.15,
    base: "contratos",
    mesInicio: 9,
    status: "em estudo",
    aguardaParecer: false,
    natureza: "receita",
    obs: "Taxa por pessoa alocada; adesão = parte dos contratos que vêm de empresas.",
  },
  {
    id: "publicamos_pago",
    nome: "\"Publicamos para você\" pago",
    valor: 150,
    unidade: "R$ por anúncio montado",
    adesao: 0.2,
    base: "donos_novos",
    mesInicio: 4,
    status: "em estudo",
    aguardaParecer: false,
    natureza: "receita",
    obs: "Fotos de parceiro à parte; adesão = parte dos donos novos do mês.",
  },
  {
    id: "ferramentas_fora",
    nome: "Ferramentas para contratos fechados fora da Viva",
    valor: 39,
    unidade: "R$ por mês por assinante",
    adesao: 0.05,
    base: "donos_ativos",
    mesInicio: 12,
    status: "em estudo",
    aguardaParecer: false,
    natureza: "receita",
    obs: `Única receita recorrente: assinantes = adesão × donos ativos (base acumulada com saída de ${Math.round(SAIDA_DONOS_MES * 100)}% ao mês).`,
  },
  {
    id: "fundadores",
    nome: "Promoção fundadores (custo, não receita)",
    valor: 0.08,
    unidade: "taxa paga pelos fundadores",
    adesao: 1,
    base: "donos_novos",
    mesInicio: 4,
    status: "aguarda parecer",
    aguardaParecer: true,
    natureza: "desconto",
    obs: `Os ${FUNDADORES_REGRA.donos} primeiros donos pagam 8% em vez da faixa por ${FUNDADORES_REGRA.meses} meses: reduz a receita da taxa.`,
  },
];

export const RODAPE_SOCIOS = [
  "Potencial — parcerias e produtos sem contrato assinado ou sem parecer jurídico não são receita garantida",
  "Estimativa para decidir, não é parecer contábil",
  `Premissas de ${REFERENCIA}`,
] as const;
