/*
  Prompt 59, Parte B — PRAZO DE SOLUÇÃO da manutenção (PURO, relógio injetável). Uma regra só para o painel do dono,
  a tela do morador, o cron de avisos, a fila do admin, a taxa do dono, o selo e a exibição (59-A).

  - Prazos contam da ABERTURA, em horas corridas (PRAZO_SOLUCAO_H). Urgente: provisória em 24 h e definitiva em 72 h.
  - O dono marca "resolvido"; o morador confirma ou reabre em 48 h; sem resposta, vale a data marcada pelo dono.
  - Reaberta, o prazo original continua correndo (não zera): conta a última marcação do dono.
  - Reclassificação só pelo atendimento da Viva: os prazos são recalculados da abertura com a prioridade nova.
  - Nada financeiro (D7): nenhuma regra daqui gera valor, multa, abatimento ou rescisão.
*/
import { PRAZO_MANUTENCAO_H, PRAZO_SOLUCAO_H, dataHoraBrasilia, type UrgenciaManutencao } from "../config/atendimento.ts";

const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;

/** Prazo do morador para confirmar ou reabrir depois que o dono marca "resolvido". */
export const CONFIRMACAO_MORADOR_H = 48;
/** Aviso antes do vencimento: urgente 2 h antes; média e baixa 12 h antes. */
export const AVISO_ANTES_H: Record<UrgenciaManutencao, number> = { urgente: 2, media: 12, baixa: 12 };
/** Taxa de solução no prazo: janela e mínimo de chamados resolvidos para existir. */
export const TAXA_JANELA_DIAS = 365;
export const TAXA_MIN_RESOLVIDOS = 3;
/** Selo "Proprietário verificado": 3 soluções fora do prazo em 90 dias móveis tiram o selo (aviso na 2ª). */
export const SELO_MANUTENCAO = { janelaDias: 90, perdeCom: 3, avisoCom: 2 } as const;

export interface OrdemSolucao {
  priority: UrgenciaManutencao;
  openedAt: string;
  /** Urgente: quando o dono marcou "solução provisória aplicada". */
  provisoriaEm?: string | null;
  /** Última vez que o dono marcou "resolvido" (some ao reabrir). */
  solucaoMarcadaEm?: string | null;
  /** Fim registrado (o morador marcou Resolvida, ou confirmou, ou passaram 48 h). */
  resolvedAt?: string | null;
  solucaoConfirmadaEm?: string | null;
  reabertaEm?: string | null;
  status: string;
}

export type EstadoSolucao = "no_prazo" | "vencido" | "resolvido_no_prazo" | "resolvido_fora";

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/** Prazos de solução da ordem (provisória só no urgente). */
export function solucaoAte(o: Pick<OrdemSolucao, "priority" | "openedAt">): { provisoria: Date | null; definitiva: Date } {
  const aberta = ms(o.openedAt);
  if (o.priority === "urgente") {
    return {
      provisoria: new Date(aberta + PRAZO_SOLUCAO_H.urgente.provisoria * HORA_MS),
      definitiva: new Date(aberta + PRAZO_SOLUCAO_H.urgente.definitiva * HORA_MS),
    };
  }
  return { provisoria: null, definitiva: new Date(aberta + PRAZO_SOLUCAO_H[o.priority] * HORA_MS) };
}

/** Momento da solução: a marcação do dono (vale depois de 48 h sem resposta); senão o fim registrado. */
export function momentoSolucao(o: OrdemSolucao): number | null {
  const t = ms(o.solucaoMarcadaEm) || ms(o.resolvedAt);
  return Number.isFinite(t) ? t : null;
}

/** A ordem está resolvida (o dono marcou, ou o morador marcou)? Reaberta volta a "não". */
export const ordemResolvida = (o: OrdemSolucao) => o.status === "resolvido" && momentoSolucao(o) != null;

export interface Solucao {
  estado: EstadoSolucao;
  ate: Date;
  /** "resolver até 13/10/2026, 14:30 (horário de Brasília)" */
  texto: string;
  /** Urgente: estado da provisória (cumprida = marcada no prazo, ou resolvida antes dele). */
  provisoria: { ate: Date; estado: "pendente" | "no_prazo" | "vencido" | "cumprida" | "fora" } | null;
}

export function estadoSolucao(o: OrdemSolucao, agora: Date): Solucao {
  const p = solucaoAte(o);
  const fim = ordemResolvida(o) ? momentoSolucao(o) : null;
  const t = agora.getTime();
  let provisoria: Solucao["provisoria"] = null;
  let provisoriaFora = false;
  if (p.provisoria) {
    // A definitiva também conta como provisória (resolveu de vez antes das 24 h).
    const marcada = ms(o.provisoriaEm) || (fim ?? NaN);
    const lim = p.provisoria.getTime();
    const estadoProv = Number.isFinite(marcada) ? (marcada <= lim ? "cumprida" : "fora") : t > lim ? "vencido" : "no_prazo";
    provisoriaFora = estadoProv === "fora" || estadoProv === "vencido";
    provisoria = { ate: p.provisoria, estado: estadoProv };
  }
  const lim = p.definitiva.getTime();
  const estado: EstadoSolucao =
    fim != null ? (fim <= lim && !provisoriaFora ? "resolvido_no_prazo" : "resolvido_fora") : t > lim || provisoriaFora ? "vencido" : "no_prazo";
  return { estado, ate: p.definitiva, texto: `resolver até ${dataHoraBrasilia(p.definitiva)} (horário de Brasília)`, provisoria };
}

// ── Confirmação do morador (48 h) ────────────────────────────────────────────────────────────────────────────────
/** Depois do "resolvido" do dono, o morador ainda pode confirmar ou reabrir? */
export function moradorPodeResponder(o: OrdemSolucao, agora: Date): boolean {
  const marcada = ms(o.solucaoMarcadaEm);
  return o.status === "resolvido" && !o.solucaoConfirmadaEm && Number.isFinite(marcada) && agora.getTime() - marcada < CONFIRMACAO_MORADOR_H * HORA_MS;
}

/** Passaram 48 h sem resposta do morador: fica resolvido na data marcada pelo dono (o cron grava a confirmação). */
export function confirmacaoVencida(o: OrdemSolucao, agora: Date): boolean {
  const marcada = ms(o.solucaoMarcadaEm);
  return o.status === "resolvido" && !o.solucaoConfirmadaEm && Number.isFinite(marcada) && agora.getTime() - marcada >= CONFIRMACAO_MORADOR_H * HORA_MS;
}

/** Colunas da reabertura pelo morador: volta a "em atendimento"; o prazo original segue (opened_at não muda). */
export function camposReabertura(agora: Date): Record<string, string | null> {
  return { status: "em_andamento", reaberta_em: agora.toISOString(), solucao_marcada_em: null, resolved_at: null, solucao_confirmada_em: null };
}

// ── Reclassificação (só o atendimento da Viva) ───────────────────────────────────────────────────────────────────
export type PapelReclassificacao = "admin_aal2" | "admin_sem_aal2" | "proprietario" | "inquilino";

export function reclassificar(
  o: { priority: UrgenciaManutencao; prioridadeOriginal?: UrgenciaManutencao | null },
  nova: unknown,
  motivo: unknown,
  papel: PapelReclassificacao,
  quem: string,
  agora: Date,
): { ok: true; campos: Record<string, string> } | { ok: false; erro: string } {
  if (papel !== "admin_aal2") {
    return { ok: false, erro: papel === "proprietario" ? "Só o atendimento da Viva muda a prioridade. Peça a reclassificação na ordem." : "Sem permissão." };
  }
  if (nova !== "urgente" && nova !== "media" && nova !== "baixa") return { ok: false, erro: "Escolha a prioridade." };
  const m = typeof motivo === "string" ? motivo.trim() : "";
  if (m.length < 5) return { ok: false, erro: "Escreva o motivo da reclassificação." };
  if (nova === o.priority) return { ok: false, erro: "A ordem já está com essa prioridade." };
  return {
    ok: true,
    campos: {
      priority: nova,
      prioridade_original: o.prioridadeOriginal ?? o.priority,
      reclassificada_por: quem,
      reclassificada_em: agora.toISOString(),
      reclassificacao_motivo: m.slice(0, 500),
    },
  };
}

// ── Avisos (matriz) ──────────────────────────────────────────────────────────────────────────────────────────────
export type AvisoSolucao = "abertura" | "antes_do_prazo" | "vencido" | "reaberta";

/** Qual aviso de prazo cabe agora (o cron grava os enviados e não repete). */
export function avisoDevido(o: OrdemSolucao, agora: Date, enviados: readonly AvisoSolucao[]): AvisoSolucao | null {
  if (ordemResolvida(o)) return null;
  const s = estadoSolucao(o, agora);
  if (s.estado === "vencido") return enviados.includes("vencido") ? null : "vencido";
  const alvo = s.provisoria && s.provisoria.estado === "no_prazo" ? s.provisoria.ate : s.ate;
  const falta = alvo.getTime() - agora.getTime();
  if (falta <= AVISO_ANTES_H[o.priority] * HORA_MS && !enviados.includes("antes_do_prazo")) return "antes_do_prazo";
  return null;
}

/** Silêncio das 22h às 7h (horário de Brasília) — exceto urgente (segurança). */
export function emSilencio(agora: Date, prioridade: UrgenciaManutencao): boolean {
  if (prioridade === "urgente") return false;
  const h = Number(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }));
  return h >= 22 || h < 7;
}

// ── Métrica do dono e selo ───────────────────────────────────────────────────────────────────────────────────────
/**
 * taxaSolucaoNoPrazo = chamados resolvidos NO PRAZO ÷ chamados RESOLVIDOS, com solução nos últimos 12 meses.
 * Só existe com 3 ou mais resolvidos (abaixo disso, null: poucos chamados não dizem nada).
 */
export function taxaSolucaoNoPrazo(ordens: readonly OrdemSolucao[], agora: Date): { taxa: number; noPrazo: number; resolvidos: number } | null {
  const desde = agora.getTime() - TAXA_JANELA_DIAS * DIA_MS;
  const resolvidas = ordens.filter((o) => ordemResolvida(o) && (momentoSolucao(o) ?? 0) >= desde);
  if (resolvidas.length < TAXA_MIN_RESOLVIDOS) return null;
  const noPrazo = resolvidas.filter((o) => estadoSolucao(o, agora).estado === "resolvido_no_prazo").length;
  return { taxa: noPrazo / resolvidas.length, noPrazo, resolvidos: resolvidas.length };
}

/** Soluções fora do prazo (resolvidas fora, ou ainda abertas e vencidas) com vencimento nos últimos 90 dias. */
export function foraDoPrazo90d(ordens: readonly OrdemSolucao[], agora: Date): number {
  const desde = agora.getTime() - SELO_MANUTENCAO.janelaDias * DIA_MS;
  return ordens.filter((o) => {
    const s = estadoSolucao(o, agora);
    return (s.estado === "resolvido_fora" || s.estado === "vencido") && s.ate.getTime() >= desde && s.ate.getTime() <= agora.getTime();
  }).length;
}

/** O que acontece com o selo pela manutenção: perde com 3 em 90 dias; aviso prévio na 2ª. */
export function seloPelaManutencao(fora90d: number): "mantem" | "aviso" | "perde" {
  return fora90d >= SELO_MANUTENCAO.perdeCom ? "perde" : fora90d >= SELO_MANUTENCAO.avisoCom ? "aviso" : "mantem";
}

// ── Para a exibição (59-A) ───────────────────────────────────────────────────────────────────────────────────────
/** Os 4 prazos de solução para o texto do anúncio (com o de primeira resposta de cada prioridade). */
export function compromissoManutencao(): { chave: string; prioridade: UrgenciaManutencao; respostaH: number; solucaoH: number; texto: string }[] {
  const r = PRAZO_MANUTENCAO_H;
  const s = PRAZO_SOLUCAO_H;
  return [
    { chave: "urgente_provisoria", prioridade: "urgente", respostaH: r.urgente, solucaoH: s.urgente.provisoria, texto: `Urgente: solução provisória em até ${s.urgente.provisoria} h` },
    { chave: "urgente_definitiva", prioridade: "urgente", respostaH: r.urgente, solucaoH: s.urgente.definitiva, texto: `Urgente: solução definitiva em até ${s.urgente.definitiva} h` },
    { chave: "media", prioridade: "media", respostaH: r.media, solucaoH: s.media, texto: `Média: solução em até ${s.media} h` },
    { chave: "baixa", prioridade: "baixa", respostaH: r.baixa, solucaoH: s.baixa, texto: `Baixa: solução em até ${s.baixa / 24} dias` },
  ];
}
