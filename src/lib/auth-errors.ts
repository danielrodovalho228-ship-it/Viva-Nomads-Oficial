/**
 * Traduz erros do Supabase Auth em mensagens claras em português (Atualização 20).
 * Mapeia pela mensagem/código REAL do Supabase. Login mantém anti-enumeração:
 * senha errada e usuário inexistente caem na MESMA mensagem neutra.
 */
export function friendlyAuthError(message: string, contexto: "login" | "cadastro" = "login"): string {
  const m = message.toLowerCase();

  // ── CAPTCHA (Turnstile): token faltando, vencido ou já usado ──
  if (m.includes("captcha")) return "Confirme que você não é um robô e tente de novo.";

  // ── 2FA ativo, sessão ainda só com senha (aal1): updateUser de senha/e-mail exige o código ──
  if (m.includes("insufficient_aal") || m.includes("aal2 session is required"))
    return "Confirme o código do seu autenticador para alterar a senha.";

  // ── Login ──
  // Anti-enumeração: o Supabase devolve "Invalid login credentials" tanto para
  // senha errada quanto para e-mail inexistente — não revela qual dos dois.
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Reenvie a confirmação se precisar.";

  // ── Cadastro ──
  // Anti-enumeração (ordem dddccd2f): e-mail repetido recebe a MESMA mensagem de um novo.
  if (m.includes("user already registered") || m.includes("already been registered"))
    return MSG_CADASTRO_NEUTRO;
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
  // E-mail recusado pelo Supabase (domínio sem MX, domínio bloqueado, endereço inválido).
  if (
    m.includes("email_address_invalid") ||
    m.includes("email domain not allowed") ||
    (m.includes("email address") && m.includes("invalid"))
  )
    return "Não conseguimos usar este e-mail. Confira se está digitado certo ou use outro endereço.";
  // Provedor de e-mail recusou o destinatário (550 / "could not send"): o Supabase responde 500
  // unexpected_failure. É problema do ENDEREÇO, nunca o genérico (F2, ordem d90cbe91).
  if (
    m.includes("could not send") ||
    m.includes("invalid `to` field") ||
    /\b550\b/.test(m) ||
    (contexto === "cadastro" && m.includes("unexpected_failure"))
  )
    return "Não conseguimos usar este e-mail. Confira se está digitado certo ou use outro endereço.";
  // Falha de ENVIO do e-mail de confirmação (SMTP) — a conta costuma ser criada.
  if (isEmailSendError(m))
    return "Conta criada. Não conseguimos enviar o e-mail de confirmação agora; tente reenviar em instantes.";

  // ── Genéricos ──
  if (m.includes("rate limit") || m.includes("too many") || m.includes("muitas tentativas"))
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

/** Aviso do cadastro, igual para e-mail novo e já existente (não revela se há conta). */
export const MSG_CADASTRO_NEUTRO =
  "Se este e-mail puder ser cadastrado, enviamos um link de confirmação. Confira a caixa de entrada e o spam.";

/**
 * Com "Confirm email" ligado, o Supabase responde ao cadastro de e-mail repetido
 * com um usuário "ofuscado" (identities vazio). Detecta esse caso para a tela
 * tratá-lo igual a um cadastro novo.
 */
export function cadastroDuplicadoOfuscado(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}
