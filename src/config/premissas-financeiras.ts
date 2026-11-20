/*
  PREMISSAS FINANCEIRAS — fonte única de /simulacao e /roi (documentos internos
  dos sócios). Cada número tem valor, unidade e fonte. Para mudar a conta, mude
  aqui: as duas páginas e os testes leem este arquivo.

  Referência: modelo de custos v3 validado pelo coordenador (ordem do Daniel, 05/11/2026; continuação do E559/E592):
  contrato de referência R$ 3.000 × 3 meses na faixa da carteira (12/10/8/6 — nunca 12% fixo), regime Simples × Lucro
  Presumido (Simples por padrão; Presumido como cenário alternativo, E622), fornecedores pós-CNPJ, pró-labore de referência + encargos. Dólar: R$ 5,20.
  Estimativas para decidir, não parecer contábil. Puro (sem alias "@"), para rodar no node --test.
*/
import { GESTOR_PRECO } from "./planos.ts";
import { FAIXAS_COMISSAO_PADRAO } from "../lib/cobranca/regra.ts";

export const REFERENCIA = "05/11/2026";
/** Nome do modelo de custos que estas premissas seguem. */
export const MODELO_CUSTOS = "modelo de custos v3 (validado pelo coordenador em 05/11/2026)";
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
/**
 * Aluguel mensal médio de um contrato (R$) — E592/E594: o do modelo validado (R$ 3.000; antes R$ 4.320, o exemplo do
 * Compare). A taxa incide sobre ele × MESES_MEDIOS_CONTRATO.
 */
export const ALUGUEL_MEDIO = 3000;

/**
 * Modelo v3: a taxa é a da FAIXA da carteira do dono (tabela 12/10/8/6 de lib/cobranca/regra.ts) — nunca 12% fixo. A
 * tela escolhe a faixa; o padrão é 10% (carteira de 3 a 5 imóveis), a do contrato de referência do modelo.
 */
/**
 * As faixas da carteira, lidas da REGRA DE COBRANÇA (FAIXAS_COMISSAO_PADRAO, lib/cobranca/regra.ts) — nunca uma lista
 * própria. E623 (estrutura aprovada em 04/11/2026, E564): inclui a faixa do Gestor — a taxa e o mínimo de imóveis de GESTOR_PRECO, ou
 * administradora, com cadastro assistido e contato direto (GESTOR_PRECO, config/planos.ts).
 */
export const TAXA_FAIXAS: readonly { taxa: number; carteira: string; detalhe?: string }[] = FAIXAS_COMISSAO_PADRAO.map((f) =>
  f.gestor
    ? { taxa: f.taxa, carteira: `Gestor: ${GESTOR_PRECO.minimoImoveis}+ imóveis ou administradora`, detalhe: "cadastro assistido e contato direto" }
    : { taxa: f.taxa, carteira: `${f.minImoveis}–${f.maxImoveis} imóveis` },
);
export const TAXA_MEDIA = 0.1;

/** Duração média de um contrato (meses) — premissa para os prêmios mensais. A confirmar com os dados reais. */
export const MESES_MEDIOS_CONTRATO = 3;

/** Cenários simples de contratos fechados por mês (ordem da vitrine: receita bruta da taxa). */
export const CONTRATOS_MES_CENARIOS = [10, 20, 40] as const;

// ── Custos variáveis por contrato ───────────────────────────────────────────
/*
  Modelo v3. A verificação de identidade é custo da Viva (obrigatória no fluxo) e NUNCA vira receita. A Certta NÃO tem
  preço público: 1,7 verificações × R$ 20 = R$ 34 por contrato é HIPÓTESE, rotulada assim em toda tela (nunca preço).
*/
/** Verificações de identidade por contrato fechado (hipótese do modelo v2). */
export const VERIFICACOES_POR_CONTRATO = 1.7;
/** Custo por verificação de identidade (Certta) — hipótese, preço a cotar. */
export const CUSTO_IDENTIDADE_HIPOTESE = 20;
export const ROTULO_HIPOTESE_IDENTIDADE = "hipótese — a Certta não tem preço público";
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
/*
  Modelo v3 — regime tributário, VEREDITO DO COORDENADOR (E622, 05/11; a mesma premissa do simulador oficial):
  - Simples Nacional: ~6% sobre a receita; a contribuição patronal já vem no DAS (INSS patronal R$ 0). É o PADRÃO da
    página: o regime só se decide na reunião a três.
  - Lucro Presumido (cenário alternativo, "regime em definição"): 16,33% sobre a taxa = 11,33% federais (PIS/Cofins 3,65%
    + IRPJ 4,8% + CSLL 2,88%) + ISS de 5% (teto conservador, a confirmar com o Rodolfo); + INSS patronal de 20% sobre o
    pró-labore (R$ 1.200 sobre R$ 6.000), automático, também a confirmar com o Rodolfo. A contabilidade segue a tabela da
    A2 nos dois regimes (sem acréscimo estimado). O ISS de 2% saiu: não fecha com o simulador oficial.
*/
export type RegimeId = "simples" | "presumido";
export interface Regime {
  id: RegimeId;
  nome: string;
  /** Impostos sobre a receita (0..1). */
  aliquota: number;
  /** INSS patronal sobre o pró-labore (0..1) — fora do Simples. */
  inssPatronal: number;
  detalhe: string;
}
/** O rótulo das premissas do Presumido que o contador ainda confirma. */
export const A_CONFIRMAR_RODOLFO = "a confirmar com o Rodolfo";
export const REGIMES: Regime[] = [
  { id: "simples", nome: "Simples Nacional", aliquota: 0.06, inssPatronal: 0, detalhe: "≈ 6% sobre a receita; a contribuição patronal vem no DAS" },
  {
    id: "presumido",
    nome: "Lucro Presumido",
    aliquota: 0.1633,
    inssPatronal: 0.2,
    detalhe: `16,33% sobre a taxa — 11,33% federais (PIS/Cofins 3,65% + IRPJ 4,8% + CSLL 2,88%) + ISS de 5% (teto conservador, ${A_CONFIRMAR_RODOLFO}) — e INSS patronal de 20% sobre o pró-labore (${A_CONFIRMAR_RODOLFO})`,
  },
];
/** O padrão da página: Simples. O Presumido é o cenário alternativo ("regime em definição"). */
export const REGIME_PADRAO: RegimeId = "simples";
export const ROTULO_REGIME_ALTERNATIVO = "cenário alternativo · regime em definição";
export const regimePorId = (id: RegimeId) => REGIMES.find((r) => r.id === id) ?? REGIMES[0];
/** O instrumento societário (contrato social/acordo de sócios) ainda não está fechado. */
export const SELO_SOCIETARIO = "instrumento societário em revisão";
export const IMPOSTO_OPCOES = REGIMES.map((r) => r.aliquota);
export const IMPOSTO_SOBRE_RECEITA = regimePorId(REGIME_PADRAO).aliquota;
export const IMPOSTO_TEXTO = "regime a confirmar com o contador (Simples × Lucro Presumido)";
/** E622 (veredito de 05/11): sem operador local pago desde 18/10 — a linha do modelo de 06/10 saiu da soma (R$ 0). */
export const OPERADOR_OPCOES = [0] as const;

// ── Custos fixos por mês ────────────────────────────────────────────────────
/*
  Modelo v3: fornecedores pós-CNPJ (≈ R$ 1.303/mês no modelo) + o pró-labore de referência (R$ 6.000/mês, mais os
  encargos do regime). Linhas sem preço entram como R$ 0 e vão para as lacunas.
*/
export const ROTULO_PRO_LABORE = "Pró-labore dos sócios";
export const PRO_LABORE = 6000;
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
  { rotulo: "Marketing pago", valor: 0, unidade: "R$/mês", obs: "começa em R$ 0 — a linha fica para quando houver verba" },
  { rotulo: ROTULO_PRO_LABORE, valor: PRO_LABORE, unidade: "R$/mês", obs: "referência para projeção — não é decisão; + encargos do regime" },
];
/** Fornecedores (sem o pró-labore) — o mínimo do controle deslizante. */
export const CUSTO_FORNECEDORES = cent(CUSTOS_FIXOS.filter((c) => c.rotulo !== ROTULO_PRO_LABORE).reduce((s, c) => s + c.valor, 0));
/** Encargos do pró-labore no regime (INSS patronal fora do Simples), em R$/mês. */
export const encargosProLabore = (r: Regime, proLabore = PRO_LABORE) => cent(proLabore * r.inssPatronal);
/**
 * Veredito do coordenador (05/11): custos visíveis mas FORA da soma — opcionais ou sem decisão. Aparecem no bloco
 * "Custos ainda sem valor / opcionais (não somados)" da tela; nenhum entra no custo fixo.
 */
export const OPCIONAIS_NAO_SOMADOS: Item[] = [
  {
    rotulo: "Associação à ACIUB Uberlândia",
    valor: 100,
    unidade: "R$/mês",
    obs: "Associação à ACIUB Uberlândia, ~R$ 100/mês, sugestão da Dra. Beatriz, decisão pendente",
  },
  {
    rotulo: "Caixas de e-mail da empresa (Hostinger)",
    valor: 5.99,
    unidade: "R$/mês",
    obs: "~R$ 5,99/mês (Hostinger) — fora da soma até o número de caixas ser decidido",
  },
];
/** Fora do fixo: o que não entra na conta hoje, com o porquê (sem número inventado). */
export const FORA_DO_FIXO = [
  "WhatsApp (Z-API): a cotar, se for ligado",
  "Stays (channel manager): só na fase 2 do Gestor",
  "Seguro da empresa: a Viva não tem hoje — decisão pendente",
] as const;
/**
 * E592/E594: as lacunas de custo — o que ainda não tem preço. Entram na conta como R$ 0 (a cotar) ou como hipótese, e a
 * tela as lista à parte para o resultado não parecer completo.
 */
export interface LacunaCusto {
  rotulo: string;
  /** Como entra hoje na conta. */
  situacao: string;
}
export const LACUNAS_CUSTO: LacunaCusto[] = [
  ...[...CUSTOS_FIXOS, ...CUSTOS_POR_CONTRATO]
    // O marketing pago em R$ 0 é decisão do modelo v3 (não falta de preço): fica fora das lacunas.
    .filter((c) => c.valor === 0 && c.rotulo !== "Marketing pago")
    .map((c) => ({ rotulo: c.rotulo, situacao: `R$ 0 na conta — ${c.obs ?? "a cotar"}` })),
  {
    rotulo: CUSTOS_POR_CONTRATO[0].rotulo,
    situacao: `R$ ${CUSTO_IDENTIDADE_HIPOTESE} por verificação (${ROTULO_HIPOTESE_IDENTIDADE})`,
  },
  { rotulo: "WhatsApp (Z-API)", situacao: "fora da conta — a cotar, se for ligado" },
];

/** Custo fixo (fornecedores + pró-labore de referência, antes dos encargos do regime). O controle vai de só fornecedores até R$ 12 mil. */
export const CUSTO_FIXO_FAIXA = { min: CUSTO_FORNECEDORES, max: 12000, texto: "fornecedores + pró-labore de referência; os encargos do regime somam à parte" };

/** Marketing pago por mês: o modelo v3 começa em R$ 0 (a linha existe em CUSTOS_FIXOS para quando houver verba). */
export const MARKETING_PAGO_MES = 0;
export function marketingDoMes(m: number): number {
  return m >= 1 ? MARKETING_PAGO_MES : 0;
}

/**
 * Investimento único (envelope de 06/10): jurídico, CNPJ, marca, Google Play, lançamento. Veredito do coordenador
 * (05/11): o parecer jurídico (R$ 4.000) e a consulta de 05/11 (R$ 500) estão DENTRO dele — não são linhas à parte.
 */
export const INVESTIMENTO_INICIAL = 16000;
/** "Dos quais": partes do envelope de R$ 16.000 — informativas, NÃO somadas de novo (nenhum custo em duas linhas). */
export const INVESTIMENTO_DOS_QUAIS: Item[] = [
  { rotulo: "Parecer da Dra. Beatriz", valor: 4000, unidade: "R$", obs: "proposta de 05/11, aguarda OK" },
  { rotulo: "Consulta de 05/11", valor: 500, unidade: "R$", obs: "paga pelo Rogério, a reembolsar" },
];
export const INVESTIMENTO_INICIAL_DETALHE = `dos quais: ${INVESTIMENTO_DOS_QUAIS.map(
  (i) => `${i.rotulo.charAt(0).toLowerCase()}${i.rotulo.slice(1)} R$ ${i.valor.toLocaleString("pt-BR")} (${i.obs})`,
).join(" e ")} — informativos, não somados`;
/** A cotar (não somado): custos jurídicos ainda sem número fechado — ficam fora do investimento e da projeção. */
export const INVESTIMENTO_A_COTAR: { rotulo: string; situacao: string }[] = [
  { rotulo: "Contrato do investidor", situacao: "SCP (R$ 10.000 padrão, com desconto a combinar) ou mútuo — em revisão; a cotar (não somado)" },
  { rotulo: "5 modelos de contrato", situacao: "a cotar (não somado)" },
];

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
