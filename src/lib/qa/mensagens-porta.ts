/*
  E361 — o que o formulário da porta da QA (/qa/entrar) diz em cada resposta da rota. PURO e sem dependência de
  servidor (o formulário é cliente). O 404 continua com o mesmo corpo para todas as causas (t596): a mensagem lista as
  causas possíveis e aponta o log do servidor, onde fica o motivo exato. Teste: src/lib/qa/e361-mensagens.test.ts
*/

/** O mesmo número de LIMITE_QA_POR_HORA (entrar.ts, que usa node:crypto e não entra no cliente); o teste confere. */
const LIMITE_POR_HORA = 30;

export function mensagemPortaQa(status: number | null): string {
  if (status === 429) {
    return `Limite de ${LIMITE_POR_HORA} entradas por hora atingido (por aparelho ou por conta). Tente de novo em até 1 hora.`;
  }
  if (status === 503) return "A porta não conseguiu conferir o limite de entradas agora. Tente de novo em instantes.";
  if (status === 404) {
    return "Não entrou. Causas possíveis: chave inválida (ou a porta está fechada); conta que não é conta de teste ou que tem 2FA; e-mail novo fora do padrão das contas de teste. O motivo exato fica no log do servidor (qa_porta_recusa).";
  }
  if (status === null) return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  return "A porta respondeu com um erro inesperado. Tente de novo em instantes.";
}
