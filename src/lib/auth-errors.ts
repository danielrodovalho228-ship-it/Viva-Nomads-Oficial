/**
 * Traduz erros do Supabase Auth em mensagens claras em português (Atualização 20).
 * Mapeia pela mensagem/código REAL do Supabase. Login mantém anti-enumeração:
 * senha errada e usuário inexistente caem na MESMA mensagem neutra.
 */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();

  // ── Login ──
  // Anti-enumeração: o Supabase devolve "Invalid login credentials" tanto para
  // senha errada quanto para e-mail inexistente — não revela qual dos dois.
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Reenvie a confirmação se precisar.";

  // ── Cadastro ──
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este e-mail já possui uma conta. Faça login ou recupere a senha.";
  if (
    m.includes("password should be at least") ||
    m.includes("password is too short") ||
    m.includes("password should contain") ||
    m.includes("weak password")
  )
    return `A senha precisa ter no mínimo ${MIN_PASSWORD} caracteres.`;
  if (
    m.includes("unable to validate email") ||
    m.includes("invalid email") ||
    m.includes("invalid format")
  )
    return "Digite um e-mail válido.";
  // Falha de ENVIO do e-mail de confirmação (SMTP) — a conta costuma ser criada.
  if (isEmailSendError(m))
    return "Conta criada. Não conseguimos enviar o e-mail de confirmação agora; tente reenviar em instantes.";

  // ── Genéricos ──
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde um instante e tente de novo.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  if (m.includes("database error") || m.includes("unexpected"))
    return "Não foi possível concluir agora. Tente novamente em instantes.";
  return "Não foi possível concluir. Tente novamente.";
}

/**
 * Erro de ENVIO do e-mail de confirmação (SMTP): a conta normalmente é criada,
 * mas o e-mail não saiu. Tratado como "conta criada, reenvie a confirmação".
 */
export function isEmailSendError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("error sending") ||
    m.includes("sending confirmation") ||
    m.includes("sending email") ||
    m.includes("smtp")
  );
}

/** Validação local de e-mail (antes de chamar o Supabase). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const MIN_PASSWORD = 8;
