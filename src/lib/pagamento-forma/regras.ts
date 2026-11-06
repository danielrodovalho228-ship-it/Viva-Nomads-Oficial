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
