/*
  Rótulo único de um pagamento registrado no contrato (complemento da jornada de assinatura, 19/10). Puro.
  O pagamento do valor mensal é feito por BLOCO: "Bloco 1 (2 meses: 19/10 a 18/12) — R$ 6.400 (2 × R$ 3.200)";
  nunca "Valor mensal de" com o valor do bloco inteiro. Mesmo texto na tela das duas partes e no recibo em PDF.
*/
import { brlTaxa } from "./cobranca/regra.ts";

export interface BlocoDoPagamento {
  numero: number;
  meses: number;
  inicio: string | null; // AAAA-MM-DD
  fim: string | null;
}

const diaMes = (iso: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}` : null;
};

export function rotuloPagamentoBloco(p: { tipo: string; valor: number; bloco?: BlocoDoPagamento | null; valorMensal?: number | null }): string {
  const valor = brlTaxa(p.valor);
  // A Caução é do contrato, nunca de um bloco (complemento do #884).
  if (p.tipo === "caucao") return `Caução do contrato — ${valor}`;
  if (!p.bloco) return `Pagamento — ${valor}`;
  const { numero, meses } = p.bloco;
  const ini = diaMes(p.bloco.inicio);
  const fim = diaMes(p.bloco.fim);
  const periodo = `${meses} ${meses === 1 ? "mês" : "meses"}${ini && fim ? `: ${ini} a ${fim}` : ""}`;
  const vm = p.valorMensal != null && Number.isFinite(p.valorMensal) ? Number(p.valorMensal) : null;
  const conta = meses > 1 && vm != null && vm > 0 && Math.abs(vm * meses - p.valor) < 0.01 ? ` (${meses} × ${brlTaxa(vm)})` : "";
  return `Bloco ${numero} (${periodo}) — ${valor}${conta}`;
}
