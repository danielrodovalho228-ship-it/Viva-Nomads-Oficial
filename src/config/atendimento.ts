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

/** Horas da promessa pública a uma pessoa (a mesma frase de PROMESSA_ATENDIMENTO). */
export const PROMESSA_HUMANA_H = 24;

/**
 * Prazo que o CLIENTE vê: abertura + 24 h (F23). Os prazos internos por prioridade
 * (PRAZOS) são meta da equipe e nunca aparecem para quem abriu o chamado.
 */
export function prazoPrometido(criadoEm: Date): Date {
  return new Date(criadoEm.getTime() + PROMESSA_HUMANA_H * HORA_MS);
}

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

/**
 * Prompt 59, Parte B: prazo de SOLUÇÃO do proprietário, em horas corridas desde a abertura (o de primeira resposta,
 * acima, continua igual). Urgente tem dois: solução provisória (ex.: fechar o registro) e definitiva.
 */
export const PRAZO_SOLUCAO_H = { urgente: { provisoria: 24, definitiva: 72 }, media: 72, baixa: 168 } as const;

/** Prazos de um chamado aberto em `agora` com a prioridade dada. */
export function calcularPrazos(prioridade: Prioridade, agora: Date): { primeiraResposta: Date; resolucao: Date } {
  const p = PRAZOS[prioridade];
  return {
    primeiraResposta: new Date(agora.getTime() + p.primeiraResposta * HORA_MS),
    resolucao: new Date(agora.getTime() + p.resolucao * HORA_MS),
  };
}

/**
 * Exemplos de cada prioridade de manutenção — os MESMOS na Central de Ajuda
 * (lib/atendimento/faq.ts) e no seletor do formulário. Uma fonte só.
 */
export const EXEMPLOS_MANUTENCAO: Record<UrgenciaManutencao, string> = {
  urgente: "sem água, sem luz, vazamento",
  media: "chuveiro sem aquecer, eletrodoméstico parado, internet instável",
  baixa: "lâmpada queimada, ajuste em móvel, pequenos reparos",
};

export const ROTULO_URGENCIA_MANUTENCAO: Record<UrgenciaManutencao, string> = { urgente: "Urgente", media: "Média", baixa: "Baixa" };

export function prazoManutencao(urgencia: UrgenciaManutencao, agora: Date): Date {
  return new Date(agora.getTime() + PRAZO_MANUTENCAO_H[urgencia] * HORA_MS);
}

/** Data e hora no fuso de Brasília, ex.: "13/10/2026, 14:30". */
export function dataHoraBrasilia(d: Date): string {
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

/** "responder até 13/10/2026, 14:30 (horário de Brasília)" — a frase única do prazo do proprietário. */
export function responderAte(urgencia: UrgenciaManutencao, abertoEm: Date): string {
  return `responder até ${dataHoraBrasilia(prazoManutencao(urgencia, abertoEm))} (horário de Brasília)`;
}

/*
  E817 — a RÉGUA ÚNICA da manutenção: anúncio e Central de Ajuda dizem a mesma coisa, com os DOIS prazos de cada
  prioridade (resposta do proprietário e solução), QUEM resolve, COMO o morador aciona e O QUE acontece se o prazo vencer
  — tudo o que o código já faz (manutencao-solucao.ts, manutencao-avisos.ts e o selo em ranking/ordem.ts). Nada novo.
*/
const horasOuDias = (h: number) => (h >= 24 * 7 && h % 24 === 0 ? `${h / 24} dias` : `${h} h`);

/** Uma linha por prioridade: "Urgente (sem água, sem luz, vazamento): resposta em até 4 h, solução provisória em até 24 h e definitiva em até 72 h". */
export function linhasReguaManutencao(): { prioridade: UrgenciaManutencao; texto: string }[] {
  const r = PRAZO_MANUTENCAO_H;
  const s = PRAZO_SOLUCAO_H;
  const e = EXEMPLOS_MANUTENCAO;
  const rot = ROTULO_URGENCIA_MANUTENCAO;
  return [
    { prioridade: "urgente", texto: `${rot.urgente} (${e.urgente}): resposta em até ${horasOuDias(r.urgente)}, solução provisória em até ${horasOuDias(s.urgente.provisoria)} e definitiva em até ${horasOuDias(s.urgente.definitiva)}` },
    { prioridade: "media", texto: `${rot.media} (${e.media}): resposta em até ${horasOuDias(r.media)} e solução em até ${horasOuDias(s.media)}` },
    { prioridade: "baixa", texto: `${rot.baixa} (${e.baixa}): resposta em até ${horasOuDias(r.baixa)} e solução em até ${horasOuDias(s.baixa)}` },
  ];
}

/** Quem resolve e como o morador aciona (o canal real: o contrato e a área de manutenção do painel). */
export const COMO_ACIONAR_MANUTENCAO = 'Quem resolve é o proprietário; com o contrato ativo, o pedido é aberto pelo próprio contrato ("Problema com isto?")';

/** O que acontece se o prazo de solução vencer (avisos do 59-B e o selo do anúncio). */
export const SE_O_PRAZO_VENCER =
  "Se o prazo de solução vencer, você é avisado e pode chamar um parceiro de manutenção pela própria ordem; soluções fora do prazo repetidas tiram o selo do anúncio";

/**
 * Frase da Central de Ajuda (e do atendimento): a mesma régua do anúncio, lida das constantes acima. O COMO abrir o
 * pedido fica na própria resposta da Ajuda, que muda conforme quem pergunta (com ou sem contrato).
 */
export function frasePrazosManutencao(): string {
  return `O proprietário é avisado na hora. ${linhasReguaManutencao().map((l) => `${l.texto}.`).join(" ")} ${SE_O_PRAZO_VENCER}.`;
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
