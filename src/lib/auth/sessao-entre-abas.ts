/*
  49-C1 — sem tela órfã na entrada por código. PURO. Quando a pessoa entra (por código ou por um link antigo de
  confirmação), a aba grava CHAVE_ENTROU no armazenamento local; as outras abas paradas em "Digite o código" ouvem o
  evento "storage" e conferem a sessão. A conferência periódica cobre o que não dispara evento (o cookie de sessão
  gravado pelo /auth/confirm em outra aba).
*/

export const CHAVE_ENTROU = "vn-entrou";
export const INTERVALO_CONFERE_SESSAO_MS = 3000;

/** A sessão encontrada é da conta que pediu o código (sem diferenciar maiúsculas e espaços). */
export function mesmaConta(emailDaSessao: string | null | undefined, emailDigitado: string): boolean {
  const a = (emailDaSessao ?? "").trim().toLowerCase();
  return !!a && a === emailDigitado.trim().toLowerCase();
}
