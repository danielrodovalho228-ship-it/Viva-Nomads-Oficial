/*
  E361 — o que o formulário da porta da QA (/qa/entrar) diz em cada resposta da rota. PURO e sem dependência de
  servidor (o formulário é cliente). E488: com a chave certa, a porta devolve a causa (403 + código) e a frase é só
  dela; o 404 (chave que não confere) segue com o mesmo corpo. Testes: e361-mensagens.test.ts e e488-causa-recusa.test.ts
*/

/** O mesmo número de LIMITE_QA_POR_HORA (entrar.ts, que usa node:crypto e não entra no cliente); o teste confere. */
const LIMITE_POR_HORA = 30;

/** E488: as causas que a porta devolve (403) a quem tem a chave certa — uma frase para cada, só dela. */
export const MOTIVOS_COM_CAUSA = ["perfil", "2fa", "padrao", "admin_fechada", "email"] as const;
const FRASE_DA_CAUSA: Record<(typeof MOTIVOS_COM_CAUSA)[number], string> = {
  perfil: "Este e-mail não é de uma conta de teste: a porta só entra em contas de teste de morador ou proprietário.",
  "2fa": "Esta conta de teste tem a verificação em duas etapas ligada: a porta não entra em conta com 2FA.",
  padrao: "Não há conta com este e-mail, e ele está fora do padrão das contas de teste novas: nenhuma conta foi criada.",
  admin_fechada: "A entrada do admin observador está fechada (lançamento ou depois de 31/12/2026).",
  email: "O e-mail digitado não é um e-mail válido. Confira e tente de novo.",
};

export function mensagemPortaQa(status: number | null, motivo?: string | null): string {
  if (status === 403) {
    return (FRASE_DA_CAUSA as Record<string, string>)[motivo ?? ""] ?? "A porta recusou a entrada nesta conta.";
  }
  if (status === 429) {
    return `Limite de ${LIMITE_POR_HORA} entradas por hora atingido (por aparelho ou por conta). Tente de novo em até 1 hora.`;
  }
  if (status === 503) return "A porta não conseguiu conferir o limite de entradas agora. Tente de novo em instantes.";
  // E488: esta página só existe com a porta ligada, então o 404 do envio é a chave que não confere.
  if (status === 404) return "A chave não confere. Confira a chave da QA e tente de novo.";
  if (status === null) return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  return "A porta respondeu com um erro inesperado. Tente de novo em instantes.";
}
