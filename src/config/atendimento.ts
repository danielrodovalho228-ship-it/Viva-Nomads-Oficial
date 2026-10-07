/*
  ATENDIMENTO — fonte única dos prazos. PURO (sem imports
  de servidor): o cálculo de prazo recebe "agora" por parâmetro (relógio
  injetável — testes e o simulador). Em produção, sempre a hora real.

  Prazos em horas corridas (a Viva atende 24 h; a equipe, em até 24 h).
*/

export type Prioridade = "p1" | "p2" | "p3" | "p4";
export type UrgenciaManutencao = "urgente" | "media" | "baixa";

/**
 * Promessa pública do atendimento (decisão do Daniel, out/2026): a Viva responde
 * 24 h e uma pessoa em até 24 h. Não prometer janela humana que não se cumpre.
 */
export const PROMESSA_ATENDIMENTO = "Assistente Viva 24 h · resposta de uma pessoa em até 24 h";

const HORA_MS = 3_600_000;

/**
 * Prazos INTERNOS por prioridade (meta da equipe), em horas corridas — a
 * promessa pública é uma só (PROMESSA_ATENDIMENTO). P1 avisa o Daniel na hora.
 */
export const PRAZOS: Record<Prioridade, { primeiraResposta: number; resolucao: number; rotulo: string }> = {
  p1: { primeiraResposta: 4, resolucao: 24, rotulo: "Urgente" },
  p2: { primeiraResposta: 12, resolucao: 48, rotulo: "Alta" },
  p3: { primeiraResposta: 24, resolucao: 72, rotulo: "Normal" },
  p4: { primeiraResposta: 24, resolucao: 120, rotulo: "Baixa" },
};

/** Manutenção: prazo do PROPRIETÁRIO, em horas corridas (falta de água não espera o horário). */
export const PRAZO_MANUTENCAO_H: Record<UrgenciaManutencao, number> = { urgente: 4, media: 24, baixa: 72 };

/** Prazos de um chamado aberto em `agora` com a prioridade dada. */
export function calcularPrazos(prioridade: Prioridade, agora: Date): { primeiraResposta: Date; resolucao: Date } {
  const p = PRAZOS[prioridade];
  return {
    primeiraResposta: new Date(agora.getTime() + p.primeiraResposta * HORA_MS),
    resolucao: new Date(agora.getTime() + p.resolucao * HORA_MS),
  };
}

export function prazoManutencao(urgencia: UrgenciaManutencao, agora: Date): Date {
  return new Date(agora.getTime() + PRAZO_MANUTENCAO_H[urgencia] * HORA_MS);
}

/** Frase para o usuário: quando uma pessoa responde. */
export function mensagemPrazo(prioridade: Prioridade): string {
  return `Recebemos. ${frasePrazo(prioridade)}`;
}

/** Só o prazo (sem o "Recebemos."), para compor com outras frases. */
export function frasePrazo(prioridade: Prioridade): string {
  return prioridade === "p1"
    ? "Seu caso tem prioridade máxima: a equipe já foi avisada e uma pessoa responde em até 24 h."
    : "Uma pessoa da equipe responde em até 24 h.";
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
