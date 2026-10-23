/*
  Prompt 39-B, fase 1 — "Recibos e notas" (PURO, node --test).

  A Viva não emite nada novo aqui: os únicos documentos são os de documentos_fiscais (recibo de locação, comprovante
  de Caução, termo de devolução) e o documento que o próprio parceiro envia no pedido. O resumo do mês (Carnê-Leão),
  o informe anual e o resumo para reembolso são RELATÓRIOS feitos a partir desses recibos: não ganham número de
  registro e nunca criam linha em documentos_fiscais.

  Regra de cálculo (escrita no rodapé de cada relatório): soma dos recibos confirmados no mês. Recibo = recibo de
  locação de um pagamento confirmado pelo morador; anulado não entra; Caução não é rendimento e fica fora do
  resumo do Carnê-Leão (aparece só na lista de documentos).
*/

import { formatarDocumento } from "../documento-pessoa.ts";

export type TipoRecibo = "recibo_aluguel" | "comprovante_caucao" | "termo_devolucao_caucao";

export interface Pessoa {
  nome: string;
  /** CPF/CNPJ como gravado no retrato do documento (pode faltar). */
  doc: string | null;
}

/** Um documento de documentos_fiscais, já no formato da tela (sem nada do perfil atual). */
export interface Recibo {
  id: string;
  tipo: TipoRecibo;
  numero: string;
  /** valor + encargos do retrato do documento. */
  valor: number;
  /** Data do recebimento (yyyy-mm-dd): a data do pagamento declarada; sem ela, a data da emissão. */
  data: string;
  /** Quem pagou (o morador) e quem recebeu (o proprietário), como no documento. */
  pagador: Pessoa;
  recebedor: Pessoa;
  contratoId: string | null;
  imovelId: string | null;
  imovelTitulo: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  anulado: boolean;
}

export const FORMULA_RESUMO = "soma dos recibos confirmados no mês";
export const FORMULA_INFORME = "soma dos recibos confirmados no ano";
export const AVISO_FIXO = "Estes valores vêm dos recibos da Viva. A declaração é sua ou do seu contador.";

export const ROTULO_RECIBO: Record<TipoRecibo, string> = {
  recibo_aluguel: "Recibo de locação",
  comprovante_caucao: "Comprovante de Caução",
  termo_devolucao_caucao: "Termo de devolução da Caução",
};

const centavos = (n: number) => Math.round(n * 100);
const reais = (c: number) => c / 100;

export const ehMes = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const ehAno = (s: unknown): s is number => Number.isInteger(s) && (s as number) >= 2020 && (s as number) <= 2100;

/** Só o recibo de locação válido conta como valor recebido. */
export function contaComoRecebido(r: Recibo): boolean {
  return r.tipo === "recibo_aluguel" && !r.anulado && Number.isFinite(r.valor) && r.valor >= 0;
}

/** Chave da pessoa: o documento (só dígitos) quando existe; senão o nome normalizado. */
export function chavePessoa(p: Pessoa): string {
  const dig = (p.doc ?? "").replace(/\D/g, "");
  return dig ? `doc:${dig}` : `nome:${p.nome.trim().toLocaleLowerCase("pt-BR")}`;
}

export interface TotalPorPessoa {
  nome: string;
  /** CPF/CNPJ formatado (000.000.000-00) ou null. Só aparece na tela de Recibos e no PDF, nunca em URL. */
  doc: string | null;
  total: number;
  recibos: number;
}

function porPessoa(lista: Recibo[], lado: "pagador" | "recebedor"): TotalPorPessoa[] {
  const mapa = new Map<string, { nome: string; doc: string | null; c: number; n: number }>();
  for (const r of lista) {
    const p = r[lado];
    const k = chavePessoa(p);
    const atual = mapa.get(k) ?? { nome: p.nome, doc: formatarDocumento(p.doc) || null, c: 0, n: 0 };
    atual.c += centavos(r.valor);
    atual.n += 1;
    mapa.set(k, atual);
  }
  return [...mapa.values()]
    .map((x) => ({ nome: x.nome, doc: x.doc, total: reais(x.c), recibos: x.n }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface ResumoMes {
  mes: string;
  total: number;
  porPagador: TotalPorPessoa[];
  recibos: Recibo[];
  formula: string;
}

/** Resumo do mês para o Carnê-Leão: recebido no mês, por pagador. Mês sem recibo = total zero e lista vazia. */
export function resumoCarneLeao(recibos: readonly Recibo[], mes: string): ResumoMes {
  if (!ehMes(mes)) throw new Error("mês inválido (use aaaa-mm)");
  const doMes = recibos.filter((r) => contaComoRecebido(r) && r.data.slice(0, 7) === mes).sort((a, b) => a.data.localeCompare(b.data) || a.numero.localeCompare(b.numero));
  return {
    mes,
    total: reais(doMes.reduce((s, r) => s + centavos(r.valor), 0)),
    porPagador: porPessoa(doMes, "pagador"),
    recibos: doMes,
    formula: FORMULA_RESUMO,
  };
}

export interface LinhaInforme extends TotalPorPessoa {
  /** Total de cada mês do ano ("01" a "12"); mês sem recibo = 0. */
  meses: Record<string, number>;
}

export interface Informe {
  ano: number;
  total: number;
  /** Proprietário: por pagador (quem pagou). Morador: por recebedor (a quem pagou). */
  linhas: LinhaInforme[];
  lado: "pagador" | "recebedor";
  formula: string;
}

const MESES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

/** Informe anual (DIRPF): total por pessoa no ano, com a quebra por mês. */
export function informeAnual(recibos: readonly Recibo[], ano: number, lado: "pagador" | "recebedor" = "pagador"): Informe {
  if (!ehAno(ano)) throw new Error("ano inválido");
  const doAno = recibos.filter((r) => contaComoRecebido(r) && r.data.slice(0, 4) === String(ano));
  const linhas = porPessoa(doAno, lado).map((t) => {
    const k = chavePessoa({ nome: t.nome, doc: t.doc });
    const meses = Object.fromEntries(MESES.map((m) => [m, 0])) as Record<string, number>;
    for (const r of doAno) {
      if (chavePessoa(r[lado]) !== k) continue;
      const m = r.data.slice(5, 7);
      meses[m] = reais(centavos(meses[m]) + centavos(r.valor));
    }
    return { ...t, meses };
  });
  return { ano, total: reais(doAno.reduce((s, r) => s + centavos(r.valor), 0)), linhas, lado, formula: FORMULA_INFORME };
}

/** CSV do informe (separador ";" e vírgula decimal: abre direto no Excel em português). */
export function informeCsv(inf: Informe): string {
  const quem = inf.lado === "pagador" ? "Pagador" : "Recebedor";
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const campo = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const cab = [quem, "CPF/CNPJ", ...MESES.map((m) => `${m}/${inf.ano}`), "Total no ano"].join(";");
  const linhas = inf.linhas.map((l) => [campo(l.nome), l.doc ?? "", ...MESES.map((m) => num(l.meses[m] ?? 0)), num(l.total)].join(";"));
  const total = ["Total", "", ...MESES.map((m) => num(inf.linhas.reduce((s, l) => s + (l.meses[m] ?? 0), 0))), num(inf.total)].join(";");
  return [cab, ...linhas, total, `Cálculo: ${inf.formula}`, AVISO_FIXO].join("\n") + "\n";
}

export interface MesPago {
  mes: string;
  total: number;
  recibos: { numero: string; valor: number; data: string }[];
}

export interface ResumoReembolso {
  contratoId: string;
  imovelTitulo: string;
  recebedor: Pessoa | null;
  periodoInicio: string | null;
  periodoFim: string | null;
  meses: MesPago[];
  total: number;
  /** Caução paga (comprovante válido): informada à parte; não é despesa de moradia. */
  caucao: number;
}

/**
 * Resumo para o reembolso da empresa (morador): os valores pagos de UMA estadia, mês a mês (pela data do pagamento),
 * com o número de cada recibo. Recibo de outra estadia nunca entra.
 */
export function resumoReembolso(recibos: readonly Recibo[], contratoId: string): ResumoReembolso {
  const daEstadia = recibos.filter((r) => r.contratoId === contratoId && !r.anulado);
  const pagos = daEstadia.filter(contaComoRecebido).sort((a, b) => a.data.localeCompare(b.data));
  const mapa = new Map<string, MesPago>();
  for (const r of pagos) {
    const m = r.data.slice(0, 7);
    const atual = mapa.get(m) ?? { mes: m, total: 0, recibos: [] };
    atual.total = reais(centavos(atual.total) + centavos(r.valor));
    atual.recibos.push({ numero: r.numero, valor: r.valor, data: r.data });
    mapa.set(m, atual);
  }
  const caucao = daEstadia.filter((r) => r.tipo === "comprovante_caucao").reduce((s, r) => s + centavos(r.valor), 0);
  const inicios = daEstadia.map((r) => r.periodoInicio).filter((d): d is string => !!d).sort();
  const fins = daEstadia.map((r) => r.periodoFim).filter((d): d is string => !!d).sort();
  return {
    contratoId,
    imovelTitulo: daEstadia[0]?.imovelTitulo ?? "Estadia",
    recebedor: daEstadia[0]?.recebedor ?? null,
    periodoInicio: inicios[0] ?? null,
    periodoFim: fins[fins.length - 1] ?? null,
    meses: [...mapa.values()],
    total: reais(pagos.reduce((s, r) => s + centavos(r.valor), 0)),
    caucao: reais(caucao),
  };
}

/** Filtros da tela do dono (imóvel e mês). Mês vazio = todos. */
export function filtrarRecibos(recibos: readonly Recibo[], f: { imovelId?: string | null; mes?: string | null }): Recibo[] {
  return recibos.filter((r) => (!f.imovelId || r.imovelId === f.imovelId) && (!f.mes || r.data.slice(0, 7) === f.mes));
}

/** Meses com algum documento, do mais recente ao mais antigo (para o seletor). */
export function mesesComDocumento(recibos: readonly Recibo[]): string[] {
  return [...new Set(recibos.map((r) => r.data.slice(0, 7)).filter(ehMes))].sort().reverse();
}

// ── Parceiro ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface ServicoConcluido {
  id: string;
  codigo: string;
  categoria: string;
  cliente: string;
  valor: number | null;
  valorTaxa: number | null;
  valorParceiro: number | null;
  /** ISO da conclusão. */
  concluidoEm: string;
  /** O parceiro já enviou a nota ou o recibo dele no pedido. */
  temDocumento: boolean;
}

/** "Falta a nota do serviço VN-SV-XXXX": um por serviço concluído sem documento do parceiro. */
export function pendenciasDeNota(servicos: readonly ServicoConcluido[]): string[] {
  return servicos.filter((s) => !s.temDocumento).map((s) => `Falta a nota do serviço ${s.codigo}`);
}

export interface ResumoAnualParceiro {
  ano: number;
  servicos: number;
  total: number;
  taxa: number;
  liquido: number;
  semDocumento: number;
  porMes: Record<string, { servicos: number; total: number; liquido: number }>;
}

/** Resumo anual do parceiro (para o contador dele): serviços concluídos no ano, valor, taxa de 10% e líquido. */
export function resumoAnualParceiro(servicos: readonly ServicoConcluido[], ano: number): ResumoAnualParceiro {
  if (!ehAno(ano)) throw new Error("ano inválido");
  const doAno = servicos.filter((s) => s.concluidoEm.slice(0, 4) === String(ano) && s.valor != null);
  const porMes = Object.fromEntries(MESES.map((m) => [m, { servicos: 0, total: 0, liquido: 0 }])) as ResumoAnualParceiro["porMes"];
  let t = 0;
  let tx = 0;
  let l = 0;
  for (const s of doAno) {
    const m = porMes[s.concluidoEm.slice(5, 7)];
    m.servicos += 1;
    m.total = reais(centavos(m.total) + centavos(s.valor ?? 0));
    m.liquido = reais(centavos(m.liquido) + centavos(s.valorParceiro ?? 0));
    t += centavos(s.valor ?? 0);
    tx += centavos(s.valorTaxa ?? 0);
    l += centavos(s.valorParceiro ?? 0);
  }
  return { ano, servicos: doAno.length, total: reais(t), taxa: reais(tx), liquido: reais(l), semDocumento: doAno.filter((s) => !s.temDocumento).length, porMes };
}

/** "outubro de 2026" a partir de "2026-10". */
export function rotuloMes(mes: string): string {
  if (!ehMes(mes)) return mes;
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}
