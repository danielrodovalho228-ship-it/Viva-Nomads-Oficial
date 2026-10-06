/*
  PREMISSAS FINANCEIRAS — fonte única de /simulacao e /roi (documentos internos
  dos sócios). Cada número tem valor, unidade e fonte. Para mudar a conta, mude
  aqui: as duas páginas e os testes leem este arquivo.

  Referência: out/2026. Dólar: R$ 5,20. Estimativas para decidir, não parecer
  contábil. Puro (sem alias "@"), para rodar no node --test.
*/
import { MIX_ROI, plano, PLANOS, type PlanoId } from "./planos.ts";

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
export const ALUGUEL_MEDIO = 2400;

/** Mix de planos dos donos (o mesmo do /roi antigo; config/planos). */
export const MIX_PLANOS: Record<PlanoId, number> = MIX_ROI;

/** Comissão de cada plano (12/8/4/0), lida de config/planos.ts. */
export const COMISSAO: Record<PlanoId, number> = Object.fromEntries(PLANOS.map((p) => [p.id, p.comissao])) as Record<PlanoId, number>;

/**
 * Fundadores: os primeiros donos ficam 12 meses no Profissional SEM assinatura
 * (lib/fundador.ts) — pagam a comissão do Profissional e não assinam nesse ano.
 */
export const FUNDADORES = {
  quantidade: 20,
  meses: 12,
  comissao: plano("pro")!.comissao,
};

/** Seguro incêndio via parceiro: ≈ 20% de um prêmio de R$ 200/ano. Liga quando o parceiro estiver ativo. */
export const SEGURO_INCENDIO = {
  porContrato: 40,
  aviso: "depende do modelo com a seguradora: corretor SUSEP ou representante",
  aPartirDoMes: 9,
  parceiroAtivo: true,
  fonte: "https://www.seguroviagem.srv.br/blog/quanto-custa-seguro-residencial/",
};

/** Assinatura: % dos donos novos que assinam, valor médio pago e churn. */
export const ASSINATURA = { mediaPagantes: 55, churnMensal: 0.03 };

// ── Custos variáveis por contrato ───────────────────────────────────────────
export const CUSTOS_POR_CONTRATO: Item[] = [
  { rotulo: "Identidade do inquilino (documento, prova de vida, rosto)", valor: 2, unidade: "R$/contrato", fonte: "https://didit.me/pricing", obs: "Didit ≈ US$ 0,33; 500 grátis/mês. CAF sob orçamento." },
  { rotulo: "Antifraude / consulta de CPF", valor: 0, unidade: "R$/contrato", obs: "Opcional, só no aceite: ≈ R$ 10 por consulta, sob orçamento." },
  { rotulo: "Assinatura eletrônica (contrato + termo de vistoria)", valor: 6, unidade: "R$/contrato", fonte: "https://zapsign.co/plans-and-prices", obs: "≈ R$ 3 por documento além dos 50 do plano." },
  { rotulo: "Cobrança da comissão (Pix + nota + aviso)", valor: 3.5, unidade: "R$/contrato", fonte: "https://www.asaas.com/precos-e-taxas", obs: "Pix R$ 1,99 + nota R$ 0,49 + aviso R$ 0,99." },
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
  /** Fração dos donos novos que assinam um plano pago. */
  assinam: number;
}
export const MES_PRIMEIRO_CONTRATO = 4;
export const HORIZONTE_MESES = 36;
export const CENARIOS: Record<CenarioId, Cenario> = {
  pessimista: { id: "pessimista", nome: "Pessimista", contratosIniciais: 1, crescimentoMensal: 0.4, teto: 10, donosNovosMes: 2, assinam: 0.15 },
  base: { id: "base", nome: "Base", contratosIniciais: 2, crescimentoMensal: 1, teto: 35, donosNovosMes: 5, assinam: 0.25 },
  otimista: { id: "otimista", nome: "Otimista", contratosIniciais: 3, crescimentoMensal: 2.2, teto: 80, donosNovosMes: 10, assinam: 0.35 },
};

// ── Receitas futuras (DESLIGADAS: não existem hoje) ─────────────────────────
export const RECEITAS_FUTURAS: (Item & { ligada: false })[] = [
  { rotulo: "Destaque / anúncio pago", valor: 30, unidade: "R$/contrato", ligada: false, obs: "Produto não existe hoje." },
  { rotulo: "Comissão de garantia locatícia", valor: 50, unidade: "R$/contrato", ligada: false, obs: "Seguro-fiança: parceiro em estruturação." },
  { rotulo: "Serviços de parceiro (manutenção e reparos)", valor: 20, unidade: "R$/contrato", ligada: false, obs: "Não existe hoje." },
  { rotulo: "Vistoria e fotos via parceiro", valor: 0, unidade: "a combinar", ligada: false, obs: "Futuro, opcional." },
];
