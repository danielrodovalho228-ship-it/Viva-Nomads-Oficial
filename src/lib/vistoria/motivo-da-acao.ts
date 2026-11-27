/*
  E1197 (ORDEM-DUET-904) — a frase certa para cada causa de uma ação da visita recusada. PURO.
  Antes, uma guarda só ("Esta ação não está disponível.") tapava a chave do piloto fechada, a sessão ou a conta errada,
  a visita por concluir e a visita já concluída: no piloto, o avaliador lia o genérico no meio da visita e o laudo
  ficou sem medição. Agora cada causa diz a sua frase; o genérico fica só para o pedido que não existe.
*/

export const MSG_SEM_ACESSO = "Esta ação não está disponível.";
/** A frase que já existia para a chave desligada. */
export const MSG_DESLIGADA = "A avaliação do imóvel ainda não está disponível.";
/** Texto julgado pelo Gerente (ORDEM-DUET-904): sem sessão, ou o pedido não é desta conta. */
export const MSG_ENTRE_DE_NOVO = "Entre de novo na conta deste pedido para continuar.";
/** Texto julgado pelo Gerente (ORDEM-DUET-904): a medição depois do laudo emitido. */
export const MSG_VISITA_CONCLUIDA = "Esta visita já foi concluída.";
/** A frase que o servidor já tinha (laudo-servidor.ts) e a guarda tapava. */
export const MSG_CONCLUA_A_VISITA = "Conclua a visita antes de enviar o laudo.";

/** Por que a leitura do avaliador do pedido não deu: a chave, a sessão, o pedido ou a conta. */
export type FalhaDoAvaliador = "desligada" | "sem_sessao" | "inexistente" | "outra_conta";

export function mensagemDaFalha(f: FalhaDoAvaliador): string {
  if (f === "desligada") return MSG_DESLIGADA;
  if (f === "inexistente") return MSG_SEM_ACESSO;
  return MSG_ENTRE_DE_NOVO;
}

/** Os estados em que a visita está a decorrer (o checklist, as fotos, as medições). */
export const ESTADOS_EM_VISITA: readonly string[] = ["agendado", "realizada"];
/** Os estados antes da visita concluída: o laudo ainda não pode sair. */
const ANTES_DA_VISITA_CONCLUIDA: readonly string[] = ["pedido", "designado", "agendado"];

/** "Medir agora": null quando pode medir; a frase da causa quando não pode. */
export function recusaDaMedicao(status: string): string | null {
  if (ESTADOS_EM_VISITA.includes(status)) return null;
  if (status === "laudo_emitido") return MSG_VISITA_CONCLUIDA;
  return MSG_SEM_ACESSO;
}

/** "Assinar laudo": null com a visita concluída; antes dela, a frase do servidor. */
export function recusaDoLaudo(status: string): string | null {
  if (status === "realizada") return null;
  if (ANTES_DA_VISITA_CONCLUIDA.includes(status)) return MSG_CONCLUA_A_VISITA;
  return MSG_SEM_ACESSO;
}
