/*
  E213-B — limpeza/lavanderia automática da saída (Prompt 38) quando a estadia é renovada ou remarcada (aditivo
  assinado → evento estadia_remarcada). Regras PURAS; quem grava é o servidor (servidor.ts e reagendamento-servidor.ts).
  Roda: node --test src/lib/automacao/remarcacao.test.ts

  1. Sem aceite (solicitado/orçado) e a nova saída a até 5 dias: o pedido ganha a janela nova (mesma chave).
  2. Sem aceite e a nova saída a mais de 5 dias: o pedido é cancelado e a chave dele ganha o sufixo
     ":remarcado:<ts>" — a chave original fica livre e o cron (D-5) refaz o pedido perto da nova data.
  3. Já aceito (aceito/agendado): vira reagendamento — o pedido volta a "aceito" com os horários da janela nova e o
     parceiro confirma pelo fluxo de horário que já existe (o OK do dono é o próprio aditivo assinado; o valor
     combinado não muda, sem orçamento novo). Se o parceiro recusar a nova data, segue o caminho "sem aceite" (1 ou 2).
  Nunca se troca a chave para (contrato, saída): "um pedido por saída" continua valendo.
*/
import { DIAS_ANTES_LIMPEZA, STATUS_NAO_ACEITOS } from "./pedidos-do-evento.ts";

export type DecisaoRemarcacao = "atualizar_janela" | "cancelar_remarcado" | "reagendar" | "nada";

/** Aceito pelo parceiro, ainda não começou: a nova data vira reagendamento. */
export const STATUS_REAGENDAVEIS = ["aceito", "agendado"] as const;

/** Mensagem ao parceiro quando o pedido sem aceite é cancelado porque a saída ficou longe. */
export const MSG_SAIDA_MUDOU = "A saída mudou; o pedido volta a ser feito perto da nova data.";

/** Dias de `hoje` até `data` (yyyy-mm-dd), no calendário. */
export function diasAte(hoje: string, data: string): number {
  return Math.round((Date.parse(`${data}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86_400_000);
}

/** Nova saída perto (até 5 dias, a mesma régua do cron que cria o pedido). */
export function saidaPerto(novaSaida: string, hoje: string): boolean {
  return diasAte(hoje, novaSaida) <= DIAS_ANTES_LIMPEZA;
}

/** O que a remarcação faz com o pedido automático da saída, conforme o status dele e a distância da nova saída. */
export function decidirRemarcacao(status: string, novaSaida: string, hoje: string): DecisaoRemarcacao {
  if ((STATUS_NAO_ACEITOS as readonly string[]).includes(status)) return saidaPerto(novaSaida, hoje) ? "atualizar_janela" : "cancelar_remarcado";
  if ((STATUS_REAGENDAVEIS as readonly string[]).includes(status)) return "reagendar";
  return "nada"; // em execução, entregue, concluído, recusado ou cancelado: a remarcação não mexe
}

/** O parceiro recusou a nova data: o pedido segue o caminho "sem aceite" (1 ou 2, conforme a distância). */
export function decidirRecusaDaNovaData(novaSaida: string, hoje: string): "voltar_sem_aceite" | "cancelar_remarcado" {
  return saidaPerto(novaSaida, hoje) ? "voltar_sem_aceite" : "cancelar_remarcado";
}

/** Chave do pedido que sai da frente (o mesmo padrão da troca de parceiro): a original fica livre para o cron. */
export function chaveRemarcada(chave: string, ts: number): string {
  return `${chave}:remarcado:${ts}`;
}

/** Pedido que saiu da frente (troca de parceiro ou remarcação): não é o pedido vigente daquela chave. */
export function chaveAntiga(chave: string): boolean {
  return /:(troca|remarcado):\d+$/.test(chave);
}

/**
 * Reagendamento esperando o parceiro: o pedido está "aceito" e o último evento de horário é o reagendamento (a
 * confirmação do horário novo, ou a recusa da nova data, encerra a espera). `eventos`: tipos, do mais novo ao mais velho.
 */
export const EVENTOS_DE_HORARIO = ["reagendamento", "confirmar_horario", "confirmar_horario_proposto", "recusar_nova_data"] as const;
export function reagendamentoPendente(status: string, eventos: readonly string[]): boolean {
  if (status !== "aceito") return false;
  const ultimo = eventos.find((t) => (EVENTOS_DE_HORARIO as readonly string[]).includes(t));
  return ultimo === "reagendamento";
}

/** Mensagem do reagendamento ao parceiro (a janela já vem formatada em Brasília). */
export function textoReagendamento(janela: { inicio: string; fim: string }): string {
  return `A estadia foi renovada e a saída mudou. Nova janela: entre ${janela.inicio} e ${janela.fim}. Confirme um dos novos horários ou recuse a nova data pelo pedido. O valor combinado continua o mesmo.`;
}

/**
 * Chaves de "uma vez" dos avisos da saída (automacoes_envios): levam a data, para que depois de renovar a pessoa
 * receba de novo perto da NOVA saída (a sugestão ao morador no D-7, o aviso ao dono sem parceiro no D-5).
 */
export function chaveSugestaoMorador(contratoId: string, moradorId: string, momento: "entrada" | "saida", data: string | null): string {
  return [`sugestao_parceiros_morador:${contratoId}:${moradorId}:${momento}`, data].filter(Boolean).join(":");
}
export function chaveSaidaSemParceiro(contratoId: string, donoId: string, saida: string): string {
  return `saida_sem_parceiro:${contratoId}:${donoId}:${saida}`;
}
