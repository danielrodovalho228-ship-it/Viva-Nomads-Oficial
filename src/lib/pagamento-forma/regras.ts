/*
  E647 — a FORMA DE PAGAMENTO é escolha do DONO (Daniel, 06/11/2026, por voz): bloco completo, mensal ou ambos, nas DUAS faixas
  (30–90 e 91–180 dias). A Viva constrói as ferramentas e NÃO impõe a forma. O desenho anterior (bloco até 90 dias, mensal de 91
  a 180) é o padrão pré-selecionado e recomendado. A taxa da Viva acompanha a forma: bloco, na assinatura; mensal, mês a mês.
  PURO (node --test src/lib/pagamento-forma/e647-forma-pagamento.test.ts). Só a parte NEUTRA, atrás da chave
  FORMA_PAGAMENTO_DONO_ATIVA (desligada): cronograma, texto ao morador e a escolha do dono. O pagamento é sempre direto ao
  proprietário. Fora do escopo, de propósito, até o parecer da Dra. Beatriz: fluxo de atraso, status de inadimplência, cálculo
  de encargos e notificação formal.
*/
import { cronogramaMensal, diasEntre, taxaDaParcela, type Parcela } from "../cobranca-mensal/regras.ts";

export const FORMAS = ["bloco", "mensal", "ambos"] as const;
export type FormaPagamento = (typeof FORMAS)[number];
/** A forma efetivamente usada numa estadia: uma ou outra (o "ambos" do dono oferece as duas ao morador). */
export type FormaUsada = "bloco" | "mensal";

export type FaixaEstadia = "ate_90" | "de_91";
export const FAIXAS: { id: FaixaEstadia; rotulo: string; min: number; max: number }[] = [
  { id: "ate_90", rotulo: "30 a 90 dias", min: 30, max: 90 },
  { id: "de_91", rotulo: "91 a 180 dias", min: 91, max: 180 },
];
export const MIN_DIAS_FORMA = 30;

/** O desenho anterior: vira o padrão pré-selecionado/recomendado, nunca uma imposição. */
export const PADRAO_RECOMENDADO: Record<FaixaEstadia, FormaPagamento> = { ate_90: "bloco", de_91: "mensal" };

export interface EscolhaPagamento {
  ate_90: FormaPagamento;
  de_91: FormaPagamento;
}
export const ESCOLHA_PADRAO: EscolhaPagamento = { ...PADRAO_RECOMENDADO };

export const ROTULO_FORMA: Record<FormaPagamento, string> = { bloco: "Bloco completo", mensal: "Mensal", ambos: "Bloco completo ou mensal" };

const ehForma = (v: unknown): v is FormaPagamento => typeof v === "string" && (FORMAS as readonly string[]).includes(v);

export function faixaDaEstadia(dias: number): FaixaEstadia | null {
  if (!Number.isFinite(dias)) return null;
  return FAIXAS.find((f) => dias >= f.min && dias <= f.max)?.id ?? null;
}

/** Lê o que veio do banco/formulário: sem nenhuma faixa válida = nada escolhido; faixa que falta ou é inválida cai no padrão. */
export function normalizarEscolha(raw: unknown): EscolhaPagamento | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!ehForma(r.ate_90) && !ehForma(r.de_91)) return null;
  return { ate_90: ehForma(r.ate_90) ? r.ate_90 : PADRAO_RECOMENDADO.ate_90, de_91: ehForma(r.de_91) ? r.de_91 : PADRAO_RECOMENDADO.de_91 };
}

/** As formas que o morador pode usar nesta estadia. Sem escolha do dono vale o padrão da faixa; fora das faixas, nenhuma. */
export function formasDaEstadia(escolha: EscolhaPagamento | null | undefined, dias: number): FormaUsada[] {
  const faixa = faixaDaEstadia(dias);
  if (!faixa) return [];
  const forma = (escolha ?? ESCOLHA_PADRAO)[faixa];
  return forma === "ambos" ? ["bloco", "mensal"] : [forma];
}

/** A taxa da Viva acompanha a forma: bloco, na assinatura; mensal, mês a mês (no vencimento de cada parcela). */
export function momentoDaTaxa(forma: FormaUsada): "assinatura" | "mes_a_mes" {
  return forma === "bloco" ? "assinatura" : "mes_a_mes";
}

export interface TextoFormaPagamento {
  titulo: string;
  linhas: string[];
  nota: string;
}

/** O que o morador lê antes de propor: a forma que o proprietário aceita em cada faixa. */
export function textoParaMorador(escolha: EscolhaPagamento): TextoFormaPagamento {
  return {
    titulo: "Forma de pagamento aceita pelo proprietário",
    linhas: FAIXAS.map((f) => `Estadias de ${f.rotulo}: ${ROTULO_FORMA[escolha[f.id]].toLowerCase()}`),
    nota: "O pagamento é feito diretamente ao proprietário; a Viva não recebe o dinheiro. A taxa da Viva acompanha a forma escolhida: no bloco, na assinatura; no mensal, mês a mês.",
  };
}

/** Uma linha só, para a lista de regras do anúncio. null = o dono ainda não escolheu (nada aparece). */
export function linhaFormaPagamento(escolha: EscolhaPagamento | null | undefined): string | null {
  if (!escolha) return null;
  return FAIXAS.map((f) => `${f.rotulo}: ${ROTULO_FORMA[escolha[f.id]].toLowerCase()}`).join(" · ");
}

export type ParcelaPorForma = Omit<Parcela, "venceEm" | "tipo"> & { venceEm: string; tipo: Parcela["tipo"] | "bloco" };

/**
 * O cronograma conforme a forma. Mensal: o cronograma do E641 (primeiro mês adiantado, pró-rata só no final), que aqui vale
 * também de 30 a 90 dias. Bloco: uma parcela só, "assinatura", com o valor do bloco que o chamador já calculou (a conta do
 * contrato é uma só; aqui nada é recalculado) e a taxa da Viva sobre esse valor.
 */
export function cronogramaPorForma(f: {
  forma: FormaUsada;
  checkin: string;
  checkout: string;
  aluguelMensal: number;
  taxa: number;
  valorBloco?: number;
}): { ok: true; dias: number; parcelas: ParcelaPorForma[] } | { ok: false; motivo: string } {
  if (f.forma === "mensal") return cronogramaMensal({ checkin: f.checkin, checkout: f.checkout, aluguelMensal: f.aluguelMensal, taxa: f.taxa }, { minDias: MIN_DIAS_FORMA });
  if (!(f.valorBloco !== undefined && f.valorBloco > 0)) return { ok: false, motivo: "Informe o valor do bloco." };
  const dias = diasEntre(f.checkin, f.checkout);
  if (dias < MIN_DIAS_FORMA || dias > 180) return { ok: false, motivo: `A estadia precisa ter de ${MIN_DIAS_FORMA} a 180 dias.` };
  return { ok: true, dias, parcelas: [{ numero: 1, venceEm: "assinatura", tipo: "bloco", dias: null, adiantada: false, valor: f.valorBloco, taxaViva: taxaDaParcela(f.valorBloco, f.taxa) }] };
}

// ── O SEGUNDO momento da escolha: NA HORA DA PROPOSTA (refino do Daniel, 06/11/2026) ─────────────────────────
/**
 * Trava legal: em estadias de 91 a 180 dias o BLOCO COMPLETO nasce bloqueado (só o mensal vale) até o parecer da Dra. Beatriz.
 * Quando o parecer sair, desligar esta constante é a única mudança (os testes dizem o que muda).
 */
export const BLOCO_91_180_BLOQUEADO = true;

const MENSAGEM_BLOCO_BLOQUEADO = "Em estadias de 91 a 180 dias a forma de pagamento é o mensal. O bloco completo ainda não está liberado nessa faixa.";

/** As formas que podem valer numa estadia: a preferência do dono no anúncio, já tirada a forma que a lei bloqueia. */
export function formasPermitidas(escolha: EscolhaPagamento | null | undefined, dias: number): FormaUsada[] {
  return formasDaEstadia(escolha, dias).filter((f) => !(f === "bloco" && BLOCO_91_180_BLOQUEADO && faixaDaEstadia(dias) === "de_91"));
}

export function formaAlternativa(forma: FormaUsada): FormaUsada {
  return forma === "bloco" ? "mensal" : "bloco";
}

/** A forma com que a proposta do dono começa: a primeira permitida (com "ambos", a recomendada da faixa). */
export function formaInicialDaProposta(escolha: EscolhaPagamento | null | undefined, dias: number): FormaUsada | null {
  const permitidas = formasPermitidas(escolha, dias);
  if (permitidas[0]) return permitidas[0];
  // O dono só tinha marcado o bloco numa faixa bloqueada: a única forma legal é o mensal; é ele quem confirma ao enviar.
  return BLOCO_91_180_BLOQUEADO && faixaDaEstadia(dias) === "de_91" ? "mensal" : null;
}

export type ResultadoForma = { ok: true; forma: FormaUsada } | { ok: false; erro: string };

/**
 * Confere a forma que vai numa proposta/contraproposta. A proposta final tem UMA forma só. Dono ("owner"): aceita a pedida ou
 * propõe a outra — a escolha é dele também na hora, então só a lei limita. Morador ("tenant"): só pede o que o proprietário
 * aceita no anúncio (e dentro da lei).
 */
export function validarFormaNaProposta(e: { forma: unknown; dias: number; escolha: EscolhaPagamento | null | undefined; quem: "owner" | "tenant" }): ResultadoForma {
  if (e.forma !== "bloco" && e.forma !== "mensal") return { ok: false, erro: "Escolha uma forma de pagamento: bloco completo ou mensal." };
  const faixa = faixaDaEstadia(e.dias);
  if (!faixa) return { ok: false, erro: `A estadia precisa ter de ${MIN_DIAS_FORMA} a 180 dias.` };
  if (e.forma === "bloco" && BLOCO_91_180_BLOQUEADO && faixa === "de_91") return { ok: false, erro: MENSAGEM_BLOCO_BLOQUEADO };
  if (e.quem === "tenant" && !formasPermitidas(e.escolha, e.dias).includes(e.forma)) return { ok: false, erro: "O proprietário não aceita essa forma de pagamento para este período. Escolha a que ele oferece." };
  return { ok: true, forma: e.forma };
}

/** O que o morador lê, antes de aceitar, sobre a forma FINAL da proposta. */
export function textoFormaFinal(forma: FormaUsada, dias: number): TextoFormaPagamento {
  const periodo = faixaDaEstadia(dias) === "de_91" ? "91 a 180 dias" : "30 a 90 dias";
  return forma === "mensal"
    ? {
        titulo: "Forma de pagamento: Mensal",
        linhas: [`Estadia de ${periodo}. Você paga mês a mês, direto ao proprietário, no vencimento de cada parcela.`, "A taxa da Viva também é mês a mês, junto de cada parcela."],
        nota: "O pagamento é feito diretamente ao proprietário; a Viva não recebe o dinheiro.",
      }
    : {
        titulo: "Forma de pagamento: Bloco completo",
        linhas: [`Estadia de ${periodo}. Você paga o valor do período numa parcela só, direto ao proprietário.`, "A taxa da Viva é paga na assinatura do contrato."],
        nota: "O pagamento é feito diretamente ao proprietário; a Viva não recebe o dinheiro.",
      };
}
