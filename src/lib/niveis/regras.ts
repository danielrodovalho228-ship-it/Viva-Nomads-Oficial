/*
  Adendo 59.1 — regras PURAS do nível (Essencial / Conforto / Premium), do ruído e dos extras. Sem banco e sem tela.

  - nivelDoImovel = ELO MAIS FRACO: o menor nível atendido entre todas as áreas. Abaixo do Essencial = "em_adequacao".
  - Item de Conforto/Premium provado por foto conta só com declaração + foto não recusada pelo atendimento.
  - Item com pendência aberta ou contestada (morador marcou "não confere") não conta até a correção.
  - Extras nunca entram no nível. Nível não é selo, não muda taxa e não é critério de ordem (só pesa na nota).
*/
import {
  AREAS,
  CHAVES_NIVEL,
  MATRIZ,
  NIVEIS,
  PONTOS_MEDICAO,
  ehChaveExtra,
  ehChaveNivel,
  itemNivel,
  type Area,
  type ChaveExtra,
  type ChaveNivel,
  type ClasseRuido,
  type Nivel,
  type NivelOuAdequacao,
  type PontoMedicao,
} from "../../config/niveis.ts";
import { itensFaltantes, type DeclaracaoConforto } from "../conforto/regras.ts";
import { boaParaVideochamada, type Rodada } from "../internet-medida.ts";

// ── Entradas ──────────────────────────────────────────────────────────────────────────────────────────────────────
export type StatusFoto = "pendente" | "aceita" | "recusada";

export interface ItemDeclarado {
  chave: string;
  declarado: boolean;
  fotoPath: string | null;
  fotoStatus: StatusFoto;
}

export interface RespostasRuido {
  via_intensa: boolean;
  noturno_obra_100m: boolean;
  aviao_ferrovia: boolean;
  isolamento_acustico: boolean;
}

export interface MedidaPonto extends Rodada {
  ponto: PontoMedicao | null;
  validada: boolean;
  validoAte: string;
  medidoEm: string;
}

export interface EntradaNivel {
  declaracoesConforto: readonly DeclaracaoConforto[];
  itens: readonly ItemDeclarado[];
  /** Medições do DONO (o morador confere; a do morador vira sinal, como no 57). */
  medidas: readonly MedidaPonto[];
  ruido: RespostasRuido | null;
  /** Chaves com pendência aberta ou contestada (itens de nível ou "ruido_controlado"). */
  bloqueadas: readonly string[];
  agora: Date;
}

// ── Prova ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Item provado por foto conta só declarado, com foto e sem recusa do atendimento (pendente de análise conta). */
export function itemConta(i: ItemDeclarado | undefined): boolean {
  return !!i && i.declarado && !!i.fotoPath && i.fotoStatus !== "recusada";
}

// ── Ruído (item 4) ────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Classe por EXPOSIÇÃO: nenhuma fonte = baixo; uma = médio; duas ou mais = alto. O isolamento acústico não muda a classe
 * (é o fato exibido), mas é a mitigação que deixa um imóvel "alto" chegar a Conforto/Premium.
 */
export function classeRuido(r: RespostasRuido): ClasseRuido {
  const fontes = [r.via_intensa, r.noturno_obra_100m, r.aviao_ferrovia].filter(Boolean).length;
  return fontes === 0 ? "baixo" : fontes === 1 ? "medio" : "alto";
}

/** Conforto e Premium não podem ser "alto" sem mitigação. Sem resposta, não chega a Conforto. */
export function ruidoControlado(r: RespostasRuido | null): boolean {
  if (!r) return false;
  return classeRuido(r) !== "alto" || r.isolamento_acustico;
}

export function validarRespostasRuido(x: unknown): { ok: true; respostas: RespostasRuido } | { ok: false; erro: string } {
  const o = (x ?? {}) as Record<string, unknown>;
  const chaves = ["via_intensa", "noturno_obra_100m", "aviao_ferrovia", "isolamento_acustico"] as const;
  if (!chaves.every((k) => typeof o[k] === "boolean")) return { ok: false, erro: "Responda as 4 perguntas sobre ruído." };
  return { ok: true, respostas: { via_intensa: o.via_intensa as boolean, noturno_obra_100m: o.noturno_obra_100m as boolean, aviao_ferrovia: o.aviao_ferrovia as boolean, isolamento_acustico: o.isolamento_acustico as boolean } };
}

// ── Internet por ponto ────────────────────────────────────────────────────────────────────────────────────────────
/** A medição válida e vigente mais recente de cada ponto. */
export function medidaPorPonto(medidas: readonly MedidaPonto[], agora: Date): Map<PontoMedicao, MedidaPonto> {
  const m = new Map<PontoMedicao, MedidaPonto>();
  for (const x of [...medidas].sort((a, b) => b.medidoEm.localeCompare(a.medidoEm))) {
    if (!x.ponto || !x.validada || new Date(x.validoAte).getTime() <= agora.getTime()) continue;
    if (!m.has(x.ponto)) m.set(x.ponto, x);
  }
  return m;
}

// ── Fatos e nível ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Chaves atendidas (Essencial do mínimo + itens de nível provados), já sem as bloqueadas por pendência. */
export function fatosAtendidos(e: EntradaNivel): Set<string> {
  const fatos = new Set<string>();
  const faltam = new Set<string>(itensFaltantes(e.declaracoesConforto));
  for (const d of e.declaracoesConforto) if (d.confirmado && !faltam.has(d.chave)) fatos.add(d.chave);
  const porChave = new Map(e.itens.filter((i) => ehChaveNivel(i.chave)).map((i) => [i.chave, i]));
  const medidas = medidaPorPonto(e.medidas, e.agora);
  const trabalho = medidas.get("trabalho");
  for (const k of CHAVES_NIVEL) {
    const prova = itemNivel(k).prova;
    const ok =
      prova === "foto"
        ? itemConta(porChave.get(k))
        : prova === "ruido"
          ? ruidoControlado(e.ruido)
          : k === "internet_medida_quarto"
            ? medidas.has("quarto_principal")
            : k === "internet_medida_trabalho"
              ? !!trabalho
              : boaParaVideochamada(trabalho ?? null);
    if (ok) fatos.add(k);
  }
  for (const b of e.bloqueadas) fatos.delete(b);
  return fatos;
}

/** O maior nível que a área sustenta com os fatos dados (requisitos cumulativos). */
export function nivelDaArea(area: Area, fatos: ReadonlySet<string>): NivelOuAdequacao {
  const m = MATRIZ[area];
  if (!m.essencial.every((k) => fatos.has(k))) return "em_adequacao";
  if (!m.conforto.every((k) => fatos.has(k))) return "essencial";
  if (!m.premium.every((k) => fatos.has(k))) return "conforto";
  return "premium";
}

const ORDEM: Record<NivelOuAdequacao, number> = { em_adequacao: -1, essencial: 0, conforto: 1, premium: 2 };
export const nivelAoMenos = (n: NivelOuAdequacao | null | undefined, minimo: Nivel): boolean => !!n && ORDEM[n] >= ORDEM[minimo];
const menor = (a: NivelOuAdequacao, b: NivelOuAdequacao): NivelOuAdequacao => (ORDEM[a] <= ORDEM[b] ? a : b);

export interface ResultadoNivel {
  nivel: NivelOuAdequacao;
  porArea: Record<Area, NivelOuAdequacao>;
  /** Áreas acima do nível do imóvel ("Sala: Premium"), para a ficha. */
  diferenciais: { area: Area; nivel: Nivel }[];
  /** Itens de nível que sustentam o nível atual (os que o morador confere na entrada). */
  itensQueDefinem: ChaveNivel[];
  /** Por área, o que falta para o próximo nível (página do dono). */
  faltaParaProximo: Partial<Record<Area, ChaveNivel[]>>;
}

/** ELO MAIS FRACO: o menor nível entre todas as áreas; o Essencial incompleto deixa o imóvel "em adequação". */
export function nivelDoImovel(e: EntradaNivel): ResultadoNivel {
  const fatos = fatosAtendidos(e);
  const essencialCompleto = itensFaltantes(e.declaracoesConforto).length === 0;
  const porArea = Object.fromEntries(AREAS.map((a) => [a, nivelDaArea(a, fatos)])) as Record<Area, NivelOuAdequacao>;
  let nivel: NivelOuAdequacao = essencialCompleto ? "premium" : "em_adequacao";
  for (const a of AREAS) nivel = menor(nivel, porArea[a]);
  // Essencial com pendência aberta segue o fluxo do 59 (não despublica): o nível exibido não cai abaixo do Essencial.
  if (essencialCompleto && nivel === "em_adequacao") nivel = "essencial";
  const diferenciais = AREAS.filter((a) => ORDEM[porArea[a]] > ORDEM[nivel] && porArea[a] !== "em_adequacao").map((a) => ({ area: a, nivel: porArea[a] as Nivel }));
  return { nivel, porArea, diferenciais, itensQueDefinem: itensDoNivel(nivel), faltaParaProximo: faltaParaProximo(porArea, fatos) };
}

/** Itens de nível exigidos para sustentar `nivel` (união das áreas, sem repetir). */
export function itensDoNivel(nivel: NivelOuAdequacao): ChaveNivel[] {
  if (!nivelAoMenos(nivel, "conforto")) return [];
  const s = new Set<ChaveNivel>();
  for (const a of AREAS) {
    for (const k of MATRIZ[a].conforto) s.add(k);
    if (nivel === "premium") for (const k of MATRIZ[a].premium) s.add(k);
  }
  return CHAVES_NIVEL.filter((k) => s.has(k));
}

function faltaParaProximo(porArea: Record<Area, NivelOuAdequacao>, fatos: ReadonlySet<string>): Partial<Record<Area, ChaveNivel[]>> {
  const out: Partial<Record<Area, ChaveNivel[]>> = {};
  for (const a of AREAS) {
    const n = porArea[a];
    const alvo = n === "essencial" ? MATRIZ[a].conforto : n === "conforto" ? MATRIZ[a].premium : [];
    const falta = alvo.filter((k) => !fatos.has(k));
    if (falta.length) out[a] = [...falta];
  }
  return out;
}

/** Itens de nível de uma conferência de entrada: os provados por foto do nível atual (internet é medida; ruído tem pergunta própria). */
export function itensDaConferencia(nivel: NivelOuAdequacao): ChaveNivel[] {
  return itensDoNivel(nivel).filter((k) => itemNivel(k).prova === "foto");
}

/** Pendência de nível que ainda tira o item da conta (aberta ou contestada aguardando o atendimento). */
export function pendenciaBloqueia(status: string): boolean {
  return status === "aberta" || status === "contestada";
}

// ── Extras ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function validarExtras(x: unknown): ChaveExtra[] {
  return Array.isArray(x) ? [...new Set(x.filter(ehChaveExtra))] : [];
}

export { NIVEIS, PONTOS_MEDICAO };
