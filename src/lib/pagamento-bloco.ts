/*
  Rótulo único de um pagamento registrado no contrato (complemento da jornada de assinatura, 19/10). Puro.
  O pagamento do valor mensal é feito por BLOCO: "Bloco 1 (2 meses: 19/10 a 18/12) — R$ 6.400 (2 × R$ 3.200)";
  nunca "Valor mensal de" com o valor do bloco inteiro. Mesmo texto na tela das duas partes e no recibo em PDF.
*/
import { brlTaxa } from "./cobranca/regra.ts";
import { diasInclusivos } from "./contrato-blocos.ts";
import { estadiaEmDias } from "./pagamento-componentes.ts";
import { textoBaseDeCalculo } from "./base-de-calculo.ts";
import { brl } from "./fiscal/documento.ts";

export interface BlocoDoPagamento {
  numero: number;
  meses: number;
  inicio: string | null; // AAAA-MM-DD
  fim: string | null;
}

export interface DuracaoDoBloco {
  /** O período não fecha em meses inteiros: a duração verdadeira é em dias. */
  emDias: boolean;
  dias: number | null;
  /** "31 dias" ou "2 meses". */
  texto: string;
  /** "31 dias" ou "2m" (o selo ao lado do número do bloco). */
  curto: string;
}

/**
 * E1067 — a duração de um bloco para a tela, o recibo e os documentos, pela FONTE ÚNICA do dinheiro (fusão do #4078,
 * mapa v4, ORDEM-DUET-1140): "em dias" decide-o o PRAZO DO CONTRATO (estadiaEmDias), com a mesma condição do
 * fatorDoBloco — contrato contado em dias e bloco com datas: os dias do bloco ("31 dias"); senão, os meses do bloco.
 * Os dias contam-se com o diasInclusivos, o mesmo do dinheiro. O contrato em dias guarda no bloco os meses de
 * REFERÊNCIA (31 dias → 2), e dizer "2 meses" para 31 dias pagos a 31/30 do valor mensal é falso.
 */
export function duracaoDoBloco(b: Pick<BlocoDoPagamento, "meses" | "inicio" | "fim"> & { numero?: number }, prazoTotalDias: number): DuracaoDoBloco {
  const meses = Math.max(1, Math.round(Number(b.meses) || 1));
  const dias = b.inicio && b.fim ? diasInclusivos(b.inicio, b.fim) : null;
  if (!estadiaEmDias(prazoTotalDias) || dias === null) return { emDias: false, dias, texto: `${meses} ${meses === 1 ? "mês" : "meses"}`, curto: `${meses}m` };
  const texto = `${dias} ${dias === 1 ? "dia" : "dias"}`;
  return { emDias: true, dias, texto, curto: texto };
}

const diaMes = (iso: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}` : null;
};

export function rotuloPagamentoBloco(p: {
  tipo: string;
  valor: number;
  bloco?: BlocoDoPagamento | null;
  valorMensal?: number | null;
  /** E1072: 2 em diante = registro complementar do mesmo bloco. */
  parte?: number | null;
  /** E1072: o total do registro complementar (aluguel + contas + limpeza dele). */
  total?: number | null;
  /** E1067 (fusão): o prazo do contrato — decide "em dias" pela fonte única. Obrigatório: quem se esquecer, o compilador aponta. */
  prazoTotalDias: number;
  /** E1067 (ORDEM-DUET-1140, decisão 2): a forma com a conta, onde há espaço (o recibo, a página do contrato). */
  comConta?: boolean;
}): string {
  const valor = brlTaxa(p.valor);
  // E1225 (ORDEM-DUET-1127): a caução registada pela tela é a do BLOCO; a de antes, sem bloco, é a do contrato (#884).
  if (p.tipo === "caucao") return p.bloco ? `Caução do bloco ${p.bloco.numero} — ${valor}` : `Caução do contrato — ${valor}`;
  if (!p.bloco) return `Pagamento — ${valor}`;
  const { numero, meses } = p.bloco;
  const ini = diaMes(p.bloco.inicio);
  const fim = diaMes(p.bloco.fim);
  // E1067: a duração vem dos dias reais do bloco ("31 dias"), não dos meses de referência que ele guarda.
  const duracao = duracaoDoBloco(p.bloco, p.prazoTotalDias);
  const periodo = `${duracao.texto}${ini && fim ? `: ${ini} a ${fim}` : ""}`;
  // E1072: o registro complementar diz que o é e traz o total DELE (pode não ter aluguel nenhum).
  if ((p.parte ?? 1) > 1) return `Bloco ${numero}, registro complementar (${periodo}) — ${brlTaxa(p.total != null && Number.isFinite(p.total) ? Number(p.total) : p.valor)}`;
  const vm = p.valorMensal != null && Number.isFinite(p.valorMensal) ? Number(p.valorMensal) : null;
  const conta = !duracao.emDias && meses > 1 && vm != null && vm > 0 && Math.abs(vm * meses - p.valor) < 0.01 ? ` (${meses} × ${brlTaxa(vm)})` : "";
  // E1067 (ORDENS-DUET 1140 e 1154): em dias, a conta no formato do Fechamento, com o mensal no formato dos documentos;
  // N = os dias do bloco. Só na forma com a conta.
  const contaEmDias = p.comConta && duracao.emDias && vm != null && vm > 0 ? ` · ${textoBaseDeCalculo(brl(vm), { dias: duracao.dias, meses })}` : "";
  return `Bloco ${numero} (${periodo}) — ${valor}${conta}${contaEmDias}`;
}
