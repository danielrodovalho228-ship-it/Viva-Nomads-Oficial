/*
  ATENDIMENTO — fonte única dos prazos e do horário humano. PURO (sem imports
  de servidor): o cálculo de prazo recebe "agora" por parâmetro (relógio
  injetável — testes e o simulador). Em produção, sempre a hora real.

  Fuso: Brasília (UTC−3, sem horário de verão desde 2019).
*/

export type Prioridade = "p1" | "p2" | "p3" | "p4";
export type UrgenciaManutencao = "urgente" | "media" | "baixa";

/** Janela de atendimento humano (hora local de Brasília), todos os dias. */
export const HORARIO_HUMANO = { inicio: 7, fim: 22 } as const;
const OFFSET_BRASILIA_MIN = -180;

const HORAS_JANELA = HORARIO_HUMANO.fim - HORARIO_HUMANO.inicio; // 15 h = "1 dia útil"

/** Prazos por prioridade, em HORAS DE ATENDIMENTO (dentro da janela). */
export const PRAZOS: Record<Prioridade, { primeiraResposta: number; resolucao: number | "mesmo_dia"; rotulo: string; descricao: string }> = {
  p1: { primeiraResposta: 1, resolucao: "mesmo_dia", rotulo: "Urgente", descricao: "uma pessoa responde em até 1 hora" },
  p2: { primeiraResposta: 4, resolucao: 2 * HORAS_JANELA, rotulo: "Alta", descricao: "uma pessoa responde em até 4 horas" },
  p3: { primeiraResposta: HORAS_JANELA, resolucao: 3 * HORAS_JANELA, rotulo: "Normal", descricao: "uma pessoa responde em até 1 dia útil" },
  p4: { primeiraResposta: 3 * HORAS_JANELA, resolucao: 5 * HORAS_JANELA, rotulo: "Baixa", descricao: "uma pessoa responde em até 3 dias úteis" },
};

/** Manutenção: prazo do PROPRIETÁRIO, em horas corridas (falta de água não espera o horário). */
export const PRAZO_MANUTENCAO_H: Record<UrgenciaManutencao, number> = { urgente: 4, media: 24, baixa: 72 };

// ── Relógio de Brasília ──────────────────────────────────────────────────────
function local(d: Date): Date {
  // "Data local" representada em UTC (ler com getUTC*).
  return new Date(d.getTime() + OFFSET_BRASILIA_MIN * 60_000);
}
function deLocal(l: Date): Date {
  return new Date(l.getTime() - OFFSET_BRASILIA_MIN * 60_000);
}
function inicioDaJanela(l: Date): Date {
  const x = new Date(l);
  x.setUTCHours(HORARIO_HUMANO.inicio, 0, 0, 0);
  return x;
}
function fimDaJanela(l: Date): Date {
  const x = new Date(l);
  x.setUTCHours(HORARIO_HUMANO.fim, 0, 0, 0);
  return x;
}

/** Está dentro do horário humano agora? */
export function dentroDoHorario(agora: Date): boolean {
  const h = local(agora).getUTCHours();
  return h >= HORARIO_HUMANO.inicio && h < HORARIO_HUMANO.fim;
}

/** Próximo instante dentro do horário (o próprio "agora" se já estiver). */
export function proximaAbertura(agora: Date): Date {
  const l = local(agora);
  if (dentroDoHorario(agora)) return agora;
  const abre = inicioDaJanela(l);
  if (l.getUTCHours() >= HORARIO_HUMANO.fim) abre.setUTCDate(abre.getUTCDate() + 1);
  return deLocal(abre);
}

/** Soma `horas` de atendimento a partir de `agora`, pulando a noite. */
export function somarHorasUteis(agora: Date, horas: number): Date {
  let cursor = local(proximaAbertura(agora));
  let restanteMin = Math.round(horas * 60);
  for (let guarda = 0; restanteMin > 0 && guarda < 400; guarda++) {
    const fim = fimDaJanela(cursor);
    const disponivel = Math.max(0, Math.round((fim.getTime() - cursor.getTime()) / 60_000));
    if (restanteMin <= disponivel) {
      cursor = new Date(cursor.getTime() + restanteMin * 60_000);
      restanteMin = 0;
    } else {
      restanteMin -= disponivel;
      const amanha = inicioDaJanela(cursor);
      amanha.setUTCDate(amanha.getUTCDate() + 1);
      cursor = amanha;
    }
  }
  return deLocal(cursor);
}

/** Prazos de um chamado aberto em `agora` com a prioridade dada. */
export function calcularPrazos(prioridade: Prioridade, agora: Date): { primeiraResposta: Date; resolucao: Date } {
  const p = PRAZOS[prioridade];
  const primeiraResposta = somarHorasUteis(agora, p.primeiraResposta);
  let resolucao: Date;
  if (p.resolucao === "mesmo_dia") {
    // Fim do dia de atendimento em que a 1ª resposta cai.
    resolucao = deLocal(fimDaJanela(local(primeiraResposta)));
    if (resolucao.getTime() < primeiraResposta.getTime()) resolucao = primeiraResposta;
  } else {
    resolucao = somarHorasUteis(agora, p.resolucao);
  }
  return { primeiraResposta, resolucao };
}

export function prazoManutencao(urgencia: UrgenciaManutencao, agora: Date): Date {
  return new Date(agora.getTime() + PRAZO_MANUTENCAO_H[urgencia] * 3_600_000);
}

/** Frase para o usuário: quando uma pessoa responde. */
export function mensagemPrazo(prioridade: Prioridade, agora: Date): string {
  return `Recebemos. ${frasePrazo(prioridade, agora)}`;
}

/** Só o prazo (sem o "Recebemos."), para compor com outras frases. */
export function frasePrazo(prioridade: Prioridade, agora: Date): string {
  const base = PRAZOS[prioridade].descricao;
  if (dentroDoHorario(agora)) return `Pela prioridade (${PRAZOS[prioridade].rotulo.toLowerCase()}), ${base}.`;
  return `Nosso horário de atendimento é das ${HORARIO_HUMANO.inicio}h às ${HORARIO_HUMANO.fim}h; uma pessoa responde a partir das ${HORARIO_HUMANO.inicio}h (${base}).`;
}

/**
 * Estado gravado em chamados.sla_estado — MESMA regra da varredura do banco
 * (atendimento_varrer_prazos, 0075):
 *  • sem 1ª resposta: relógio da 1ª resposta (75% do tempo = em risco);
 *  • 1ª resposta fora do prazo: estourado (fica registrado);
 *  • respondido no prazo: passa a valer o prazo de RESOLUÇÃO;
 *  • resolvido/encerrado: ok se cumpriu os dois prazos, senão estourado.
 */
export function slaDoChamado(c: {
  criadoEm: Date;
  prazoPrimeiraResposta: Date;
  primeiraRespostaEm: Date | null;
  prazoResolucao: Date;
  resolvidoEm: Date | null;
  fechado: boolean;
  agora: Date;
}): "ok" | "em_risco" | "estourado" {
  const t = (d: Date) => d.getTime();
  const relogio = (prazo: Date) =>
    t(c.agora) >= t(prazo) ? "estourado" : t(c.agora) - t(c.criadoEm) >= 0.75 * (t(prazo) - t(c.criadoEm)) ? "em_risco" : "ok";
  if (c.fechado) {
    const resposta = c.primeiraRespostaEm ?? c.resolvidoEm ?? c.agora;
    const fim = c.resolvidoEm ?? c.agora;
    return t(resposta) <= t(c.prazoPrimeiraResposta) && t(fim) <= t(c.prazoResolucao) ? "ok" : "estourado";
  }
  if (!c.primeiraRespostaEm) return relogio(c.prazoPrimeiraResposta);
  if (t(c.primeiraRespostaEm) > t(c.prazoPrimeiraResposta)) return "estourado";
  return relogio(c.prazoResolucao);
}

/** Estado do prazo para o relógio da fila: verde, amarelo (≥ 75% do tempo) ou vermelho. */
export function estadoPrazo(abertoEm: Date, prazo: Date, agora: Date, respondido: boolean): "ok" | "em_risco" | "estourado" | "cumprido" {
  if (respondido) return "cumprido";
  if (agora.getTime() >= prazo.getTime()) return "estourado";
  const total = prazo.getTime() - abertoEm.getTime();
  return total > 0 && agora.getTime() - abertoEm.getTime() >= 0.75 * total ? "em_risco" : "ok";
}
