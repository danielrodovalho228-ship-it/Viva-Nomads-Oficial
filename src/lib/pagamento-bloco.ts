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

const DIA_MS = 86_400_000;
const instante = (iso: string | null): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** Dias corridos do bloco, contando o primeiro e o último dia. */
function diasCorridos(inicio: string | null, fim: string | null): number | null {
  const a = instante(inicio);
  const b = instante(fim);
  return a === null || b === null || b < a ? null : Math.round((b - a) / DIA_MS) + 1;
}

/** Meses de calendário inteiros (19/10 a 18/12 = 2): o dia seguinte ao fim cai no mesmo dia do mês do início. */
function mesesDeCalendario(inicio: string | null, fim: string | null): number | null {
  const a = instante(inicio);
  const b = instante(fim);
  if (a === null || b === null) return null;
  const ini = new Date(a);
  const seguinte = new Date(b + DIA_MS);
  if (seguinte.getUTCDate() !== ini.getUTCDate()) return null;
  const n = (seguinte.getUTCFullYear() - ini.getUTCFullYear()) * 12 + seguinte.getUTCMonth() - ini.getUTCMonth();
  return n > 0 ? n : null;
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
 * E1067 — FONTE ÚNICA da duração de um bloco (ou do contrato inteiro) para a tela, o recibo e os documentos: os DIAS
 * REAIS do período. O contrato em dias guarda no bloco os meses de REFERÊNCIA (31 dias → 2), e dizer "2 meses" para 31
 * dias pagos a 31/30 do valor mensal é falso. Fica em meses só quando o período fecha em meses inteiros: N × 30 dias
 * corridos (o contrato em dias) ou N meses de calendário (os contratos antigos, 19/10 a 18/12). Sem datas, vale o
 * que o bloco guarda.
 */
export function duracaoDoBloco(b: Pick<BlocoDoPagamento, "meses" | "inicio" | "fim"> & { numero?: number }): DuracaoDoBloco {
  const meses = Math.max(1, Math.round(Number(b.meses) || 1));
  const dias = diasCorridos(b.inicio, b.fim);
  const emMeses = dias === null || (dias % 30 === 0 && dias / 30 === meses) || mesesDeCalendario(b.inicio, b.fim) === meses;
  if (emMeses) return { emDias: false, dias, texto: `${meses} ${meses === 1 ? "mês" : "meses"}`, curto: `${meses}m` };
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
}): string {
  const valor = brlTaxa(p.valor);
  // E1225 (ORDEM-DUET-1127): a caução registada pela tela é a do BLOCO; a de antes, sem bloco, é a do contrato (#884).
  if (p.tipo === "caucao") return p.bloco ? `Caução do bloco ${p.bloco.numero} — ${valor}` : `Caução do contrato — ${valor}`;
  if (!p.bloco) return `Pagamento — ${valor}`;
  const { numero, meses } = p.bloco;
  const ini = diaMes(p.bloco.inicio);
  const fim = diaMes(p.bloco.fim);
  // E1067: a duração vem dos dias reais do bloco ("31 dias"), não dos meses de referência que ele guarda.
  const duracao = duracaoDoBloco(p.bloco);
  const periodo = `${duracao.texto}${ini && fim ? `: ${ini} a ${fim}` : ""}`;
  // E1072: o registro complementar diz que o é e traz o total DELE (pode não ter aluguel nenhum).
  if ((p.parte ?? 1) > 1) return `Bloco ${numero}, registro complementar (${periodo}) — ${brlTaxa(p.total != null && Number.isFinite(p.total) ? Number(p.total) : p.valor)}`;
  const vm = p.valorMensal != null && Number.isFinite(p.valorMensal) ? Number(p.valorMensal) : null;
  const conta = !duracao.emDias && meses > 1 && vm != null && vm > 0 && Math.abs(vm * meses - p.valor) < 0.01 ? ` (${meses} × ${brlTaxa(vm)})` : "";
  return `Bloco ${numero} (${periodo}) — ${valor}${conta}`;
}
