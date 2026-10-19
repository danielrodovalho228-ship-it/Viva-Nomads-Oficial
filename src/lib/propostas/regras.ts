/*
  Propostas (orçamentos de verdade, prompt 17) — regras PURAS: contas do total, descontos, limites do anúncio,
  rodadas, o que cada lado pode mudar e o histórico. O servidor (propostas-actions.ts) usa estas funções antes de
  gravar; a tela usa as mesmas para mostrar o total. A proposta é documento, não cobrança: a Viva não recebe valor.
*/
import { comissaoSobreContrato, rotuloTaxaServico, taxaNaAssinatura } from "../cobranca/regra.ts";
import { descontoParaMeses, PCT_MAX, type FaixaDesconto, type ItemNegociavel, type Negociacao } from "../anuncio/negociacao.ts";

export type StatusProposta =
  | "enviada"
  | "vista"
  | "contraproposta"
  | "aceita"
  | "recusada"
  | "expirada"
  | "em_contrato"
  | "contrato_assinado";

export const STATUS_PROPOSTA: Record<StatusProposta, { rotulo: string; tom: "neutro" | "info" | "alerta" | "ok" | "erro" }> = {
  enviada: { rotulo: "Enviada", tom: "info" },
  vista: { rotulo: "Vista", tom: "info" },
  contraproposta: { rotulo: "Contraproposta", tom: "alerta" },
  aceita: { rotulo: "Aceita → Em fechamento", tom: "ok" },
  recusada: { rotulo: "Recusada", tom: "erro" },
  expirada: { rotulo: "Expirada", tom: "neutro" },
  em_contrato: { rotulo: "Em contrato", tom: "ok" },
  contrato_assinado: { rotulo: "Contrato assinado", tom: "ok" },
};

/** Filtros da lista de Orçamentos (rascunho não existe: a proposta só nasce enviada a um interessado real). */
export const FILTROS_STATUS: { chave: "todas" | StatusProposta; rotulo: string }[] = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "enviada", rotulo: "Enviadas" },
  { chave: "vista", rotulo: "Vistas" },
  { chave: "contraproposta", rotulo: "Contraproposta" },
  { chave: "aceita", rotulo: "Aceitas" },
  { chave: "recusada", rotulo: "Recusadas" },
  { chave: "expirada", rotulo: "Expiradas" },
  { chave: "em_contrato", rotulo: "Em contrato" },
];

export const STATUS_ABERTOS: readonly StatusProposta[] = ["enviada", "vista", "contraproposta"];
export function estaAberta(status: StatusProposta): boolean {
  return STATUS_ABERTOS.includes(status);
}

export const VALIDADES_DIAS = [3, 7, 15] as const;
export type ValidadeDias = (typeof VALIDADES_DIAS)[number];
/** Máximo de versões (rodadas) no total: a 1ª proposta + 2 contrapropostas. Depois, só aceitar ou recusar. */
export const MAX_VERSOES = 3;
export const MENSAGEM_MAX = 500;

export const MOTIVOS_RECUSA = [
  { chave: "valor", rotulo: "Valor" },
  { chave: "datas", rotulo: "Datas" },
  { chave: "outro_imovel", rotulo: "Encontrei outro imóvel" },
  { chave: "outro", rotulo: "Outro" },
] as const;
export type MotivoRecusa = (typeof MOTIVOS_RECUSA)[number]["chave"];
export function motivoRecusaValido(v: unknown): v is MotivoRecusa {
  return MOTIVOS_RECUSA.some((m) => m.chave === v);
}

export const MOTIVOS_DESCONTO = ["Estadia longa", "Entrada imediata"] as const;

export type Autor = "owner" | "tenant";

/** Os valores de uma versão da proposta. */
export interface TermosProposta {
  /** Valor mensal antes dos descontos. */
  valorBase: number;
  /** Desconto manual do proprietário, em % do valor mensal (0..30). */
  descontoPct: number;
  /** Desconto manual do proprietário, em R$ por mês. */
  descontoValor: number;
  motivoDesconto: string | null;
  /** Desconto automático por estadia mais longa (faixas do anúncio), em %. */
  descontoEstadiaPct: number;
  meses: number;
  /** AAAA-MM-DD */
  dataEntrada: string;
  condominio: number;
  consumo: number;
  limpezasMes: number;
  valorLimpeza: number;
  taxaPet: number;
  /** Itens únicos (limpeza de preparação/pacote único). */
  limpezaUnica: number;
}

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Valor mensal final: base × (1 − (desconto manual % + desconto de estadia %)) − desconto manual em R$, arredondado
 * ao real. Ex.: 3.200 com 5% → 3.040; 3.200 com 6% de estadia longa → 3.008.
 */
export function valorMensalFinal(t: Pick<TermosProposta, "valorBase" | "descontoPct" | "descontoValor" | "descontoEstadiaPct">): number {
  const base = n(t.valorBase);
  if (!(base > 0)) return 0;
  const pct = Math.min(PCT_MAX, n(t.descontoPct) + n(t.descontoEstadiaPct));
  return Math.max(0, Math.round(base * (1 - pct / 100) - n(t.descontoValor)));
}

export interface TotaisProposta {
  valorMensal: number;
  /** Total por mês: valor mensal + condomínio + consumo + limpezas do mês + taxa pet. */
  totalMensal: number;
  /** Total do contrato: total por mês × meses + itens únicos. */
  totalContrato: number;
  /** Base da taxa de serviço: valor mensal × meses (o valor total dos contratos; nunca encargos nem itens únicos). */
  baseTaxa: number;
}

export function calcularTotais(t: TermosProposta): TotaisProposta {
  const valorMensal = valorMensalFinal(t);
  const meses = Math.max(0, Math.round(n(t.meses)));
  const totalMensal = r2(valorMensal + n(t.condominio) + n(t.consumo) + Math.round(n(t.limpezasMes)) * n(t.valorLimpeza) + n(t.taxaPet));
  return {
    valorMensal,
    totalMensal,
    totalContrato: r2(totalMensal * meses + n(t.limpezaUnica)),
    baseTaxa: valorMensal * meses,
  };
}

/** Taxa de serviço da Viva (só o proprietário vê): taxa × valor mensal × meses. */
export function taxaServicoProposta(t: TermosProposta, taxa: number): number {
  const tot = calcularTotais(t);
  return comissaoSobreContrato(tot.valorMensal, Math.round(n(t.meses)), taxa);
}

/** Taxa congelada no ACEITE da proposta: a da faixa pelos imóveis ativos do proprietário naquele momento. */
export function taxaNoAceite(imoveisAtivos: number, agora: Date): number {
  return taxaNaAssinatura({ tipo: "novo", imoveisAtivos, assinadoEm: agora }).taxa;
}

/**
 * Taxa da proposta (complemento do prompt 27, parte B — regra do Daniel, 18/10): fixada no ENVIO pela faixa do dono
 * naquele momento e NUNCA sobe depois. No aceite vale a menor entre a do envio e a da faixa atual. Proposta antiga sem
 * taxa do envio → a faixa atual.
 */
export function taxaEfetivaDaProposta(taxaNoEnvio: number | null | undefined, taxaAtual: number): number {
  const envio = taxaNoEnvio == null ? NaN : Number(taxaNoEnvio);
  return Number.isFinite(envio) ? Math.min(envio, taxaAtual) : taxaAtual;
}

/** "Sua taxa caiu para 10% por causa da sua faixa atual" — só quando a faixa atual ficou menor que a do envio. */
export function avisoTaxaCaiu(taxaNoEnvio: number | null | undefined, taxaAtual: number): string | null {
  const envio = taxaNoEnvio == null ? NaN : Number(taxaNoEnvio);
  if (!Number.isFinite(envio) || !(taxaAtual < envio)) return null;
  const pct = (taxaAtual * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `Sua taxa caiu para ${pct}% por causa da sua faixa atual`;
}

/** Antes do aceite, se a faixa de hoje for menor que a do envio: "Se aceita hoje: 10% (sua faixa melhorou)". */
export function textoSeAceitaHoje(taxaNoEnvio: number | null | undefined, taxaHoje: number): string | null {
  const envio = taxaNoEnvio == null ? NaN : Number(taxaNoEnvio);
  if (!Number.isFinite(envio) || !(taxaHoje < envio)) return null;
  return `Se aceita hoje: ${(taxaHoje * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% (sua faixa melhorou)`;
}

/** Origem gravada no aceite: a do envio quando ela venceu; senão a da regra de hoje (faixa, queda ou admin). */
export function origemDaTaxaDaProposta(
  taxaNoEnvio: number | null | undefined,
  hoje: { taxa: number; origem: "admin" | "faixa" | "faixa_com_queda_recente" },
): "admin" | "faixa" | "faixa_com_queda_recente" | "proposta_envio" {
  const envio = taxaNoEnvio == null ? NaN : Number(taxaNoEnvio);
  return Number.isFinite(envio) && envio < hoje.taxa ? "proposta_envio" : hoje.origem;
}

/** Linha do aviso ao DONO no aceite (item 34): a taxa congelada com a base escrita e, se caiu, o porquê. */
export function textoTaxaCongeladaParaDono(taxa: number, valorMensal: number, meses: number, taxaNoEnvio: number | null | undefined): string {
  const caiu = avisoTaxaCaiu(taxaNoEnvio, taxa);
  return `${rotuloTaxaServico(taxa, valorMensal, meses)} (congelada no aceite; cobrada à parte).${caiu ? ` ${caiu}.` : ""}`;
}

/** Meses permitidos pelo anúncio (prazo em dias → meses de 30 dias, entre 1 e 6). */
export function mesesDoAnuncio(minPeriodDias: number | null | undefined, maxPeriodDias: number | null | undefined): { min: number; max: number } {
  const min = Math.min(6, Math.max(1, Math.ceil(n(minPeriodDias || 30) / 30)));
  const max = Math.min(6, Math.max(min, Math.floor(n(maxPeriodDias || 180) / 30)));
  return { min, max };
}

export interface LimitesAnuncio {
  mesesMin: number;
  mesesMax: number;
  /** Capacidade do imóvel (pessoas); null = sem limite informado. */
  capacidade: number | null;
}

/** Validações do servidor (também usadas na tela). Devolve a mensagem do primeiro problema, ou null. */
export function validarTermos(t: TermosProposta, lim: LimitesAnuncio, hojeISO: string, pessoas?: number | null): string | null {
  if (!(valorMensalFinal(t) > 0) || !(n(t.valorBase) > 0)) return "Informe um valor mensal maior que zero.";
  const meses = Math.round(Number(t.meses));
  if (!Number.isFinite(meses) || meses < lim.mesesMin || meses > lim.mesesMax)
    return lim.mesesMin === lim.mesesMax
      ? `Este anúncio aceita só ${lim.mesesMin} ${lim.mesesMin === 1 ? "mês" : "meses"}.`
      : `O número de meses tem de ficar entre ${lim.mesesMin} e ${lim.mesesMax}, como no anúncio.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.dataEntrada) || t.dataEntrada <= hojeISO) return "A data de entrada tem de ser no futuro.";
  if (pessoas != null && lim.capacidade != null && pessoas > lim.capacidade)
    return `O imóvel recebe até ${lim.capacidade} ${lim.capacidade === 1 ? "pessoa" : "pessoas"}.`;
  if (n(t.descontoPct) > PCT_MAX) return `O desconto vai até ${PCT_MAX}%.`;
  if (n(t.limpezasMes) > 8) return "No máximo 8 limpezas por mês.";
  return null;
}

/** Campos que mudam numa contraproposta (e as chaves de `Negociacao.itens` que os liberam). */
export const CAMPOS_CONTRAPROPOSTA = [
  { campo: "valorBase", item: "valor_mensal", rotulo: "Valor mensal" },
  { campo: "meses", item: "meses", rotulo: "Meses" },
  { campo: "dataEntrada", item: "data_entrada", rotulo: "Data de entrada" },
  { campo: "limpezasMes", item: "limpeza", rotulo: "Limpezas por mês" },
  { campo: "taxaPet", item: "taxa_pet", rotulo: "Taxa pet" },
] as const satisfies readonly { campo: keyof TermosProposta; item: ItemNegociavel; rotulo: string }[];
export type CampoContraproposta = (typeof CAMPOS_CONTRAPROPOSTA)[number]["campo"];

export type Mudancas = Partial<Pick<TermosProposta, CampoContraproposta>>;

/**
 * Pode contrapropor? Só com a proposta em andamento, na vez da pessoa, abaixo do máximo de versões e — para o
 * interessado — com o anúncio aceitando negociar. Devolve o motivo do bloqueio ou null.
 */
export function bloqueioContraproposta(e: {
  status: StatusProposta;
  versaoAtual: number;
  quem: Autor;
  autorUltimaVersao: Autor;
  negociacao: Negociacao;
}): string | null {
  if (!estaAberta(e.status)) return "Esta proposta não está mais em andamento.";
  if (e.quem === e.autorUltimaVersao) return "Aguarde a resposta da outra parte.";
  if (e.versaoAtual >= MAX_VERSOES) return "Esta proposta já teve 3 rodadas: agora é aceitar ou recusar.";
  if (e.quem === "tenant" && !e.negociacao.aceita) return "Este anúncio tem valor fixo: dá para aceitar ou recusar.";
  return null;
}

/**
 * Monta a nova versão a partir da anterior e das mudanças pedidas. O interessado só muda os itens liberados no
 * anúncio (os outros são ignorados — e o servidor recusa, ver `mudancasProibidas`); o proprietário muda os mesmos
 * campos sem restrição de itens. O desconto de estadia longa é recalculado para os novos meses.
 */
export function aplicarContraproposta(anterior: TermosProposta, mudancas: Mudancas, descontos: readonly FaixaDesconto[]): TermosProposta {
  const nova: TermosProposta = { ...anterior };
  if (mudancas.valorBase !== undefined) nova.valorBase = Math.round(n(mudancas.valorBase) * 100) / 100;
  if (mudancas.meses !== undefined) nova.meses = Math.round(n(mudancas.meses));
  if (mudancas.dataEntrada !== undefined) nova.dataEntrada = String(mudancas.dataEntrada);
  if (mudancas.limpezasMes !== undefined) nova.limpezasMes = Math.min(8, Math.round(n(mudancas.limpezasMes)));
  if (mudancas.taxaPet !== undefined) nova.taxaPet = n(mudancas.taxaPet);
  nova.descontoEstadiaPct = descontoParaMeses(descontos, nova.meses);
  return nova;
}

/** Campos que mudaram entre duas versões (só os da contraproposta). */
export function camposAlterados(a: TermosProposta, b: TermosProposta): CampoContraproposta[] {
  return CAMPOS_CONTRAPROPOSTA.filter(({ campo }) => String(a[campo]) !== String(b[campo])).map((c) => c.campo);
}

/** Itens que o interessado tentou mudar sem o proprietário ter liberado (vazio = tudo certo). */
export function mudancasProibidas(anterior: TermosProposta, nova: TermosProposta, quem: Autor, itensLiberados: readonly ItemNegociavel[]): string[] {
  if (quem === "owner") return [];
  return CAMPOS_CONTRAPROPOSTA.filter(({ campo, item }) => String(anterior[campo]) !== String(nova[campo]) && !itensLiberados.includes(item)).map(
    (c) => c.rotulo,
  );
}

/** Uma linha do histórico: o que mudou, riscado → novo valor. */
export interface Diferenca {
  campo: CampoContraproposta | "valorMensal" | "totalContrato";
  rotulo: string;
  antes: string;
  depois: string;
}

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : iso);

function formatar(campo: CampoContraproposta, t: TermosProposta): string {
  switch (campo) {
    case "valorBase":
      return brl(t.valorBase);
    case "meses":
      return `${t.meses} ${t.meses === 1 ? "mês" : "meses"}`;
    case "dataEntrada":
      return dataBr(t.dataEntrada);
    case "limpezasMes":
      return `${t.limpezasMes} ${t.limpezasMes === 1 ? "limpeza" : "limpezas"}/mês`;
    case "taxaPet":
      return brl(t.taxaPet);
  }
}

export function diferencas(a: TermosProposta, b: TermosProposta): Diferenca[] {
  const out: Diferenca[] = camposAlterados(a, b).map((campo) => ({
    campo,
    rotulo: CAMPOS_CONTRAPROPOSTA.find((c) => c.campo === campo)!.rotulo,
    antes: formatar(campo, a),
    depois: formatar(campo, b),
  }));
  const ta = calcularTotais(a);
  const tb = calcularTotais(b);
  if (ta.valorMensal !== tb.valorMensal && !(out.length === 1 && out[0].campo === "valorBase" && a.descontoEstadiaPct === b.descontoEstadiaPct))
    out.push({ campo: "valorMensal", rotulo: "Valor mensal com desconto", antes: brl(ta.valorMensal), depois: brl(tb.valorMensal) });
  if (ta.totalContrato !== tb.totalContrato)
    out.push({ campo: "totalContrato", rotulo: "Total do contrato", antes: brl(ta.totalContrato), depois: brl(tb.totalContrato) });
  return out;
}

/**
 * Atalho "Vou ficar mais tempo": vai para a próxima faixa de desconto do anúncio (se houver e couber no prazo
 * máximo); sem faixa, soma 1 mês. null quando já está no máximo.
 */
export function mesesParaFicarMaisTempo(mesesAtual: number, mesesMax: number, descontos: readonly FaixaDesconto[]): number | null {
  if (mesesAtual >= mesesMax) return null;
  const proxima = [...descontos].map((d) => d.mesesMin).filter((m) => m > mesesAtual && m <= mesesMax).sort((a, b) => a - b)[0];
  return proxima ?? mesesAtual + 1;
}

/** "Antes: R$ 3.200 × 4 = R$ 12.800 → Agora: R$ 3.008 × 6 = R$ 18.048 (6% de desconto)" */
export function fraseMaisTempo(antes: TermosProposta, depois: TermosProposta): string {
  const va = valorMensalFinal(antes);
  const vd = valorMensalFinal(depois);
  const pct = depois.descontoEstadiaPct;
  const sufixo = pct > 0 ? ` (${String(pct).replace(".", ",")}% de desconto)` : "";
  return `Antes: ${brl(va)} × ${antes.meses} = ${brl(va * antes.meses)} → Agora: ${brl(vd)} × ${depois.meses} = ${brl(vd * depois.meses)}${sufixo}`;
}

/** Venceu a validade? (só propostas em andamento expiram). */
export function venceu(status: StatusProposta, validaAteISO: string, agora: Date): boolean {
  return estaAberta(status) && new Date(validaAteISO).getTime() < agora.getTime();
}

export function validaAteDe(dias: number, agora: Date): string {
  return new Date(agora.getTime() + dias * 86_400_000).toISOString();
}

/** Quem está com a vez: a outra parte de quem fez a última versão. */
export function daVez(autorUltimaVersao: Autor): Autor {
  return autorUltimaVersao === "owner" ? "tenant" : "owner";
}

/**
 * Contagem regressiva da validade (prompt 27, item 7): "vence hoje" (menos de 24 h), "vence amanhã", "vence em N
 * dias" ou "venceu". Em dias corridos a partir de agora.
 */
export function textoVencimento(validaAte: string | Date, agora: Date): string {
  const fim = new Date(validaAte).getTime();
  if (!Number.isFinite(fim)) return "";
  const ms = fim - agora.getTime();
  if (ms <= 0) return "venceu";
  const dias = Math.ceil(ms / 86_400_000);
  if (dias <= 1) return "vence hoje";
  if (dias === 2) return "vence amanhã";
  return `vence em ${dias} dias`;
}

/** Lembrete de 24 h (rotina de automações): proposta aberta que vence nas próximas 24 h. */
export function venceEm24h(validaAte: string | Date, agora: Date): boolean {
  const ms = new Date(validaAte).getTime() - agora.getTime();
  return Number.isFinite(ms) && ms > 0 && ms <= 86_400_000;
}

/** A proposta espera uma resposta de `papel`: aberta e a última versão é da outra parte. */
export function aguardandoResposta(status: StatusProposta, autorUltimaVersao: Autor, papel: Autor): boolean {
  return estaAberta(status) && daVez(autorUltimaVersao) === papel;
}
