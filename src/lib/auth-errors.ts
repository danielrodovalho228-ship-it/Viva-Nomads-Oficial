/**
 * Traduz erros do Supabase Auth em mensagens claras em português (Atualização 20).
 * Evita expor erro técnico cru ao usuário.
 */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.";
  if (m.includes("password should be at least") || m.includes("password is too short"))
    return "A senha deve ter pelo menos 8 caracteres.";
  if (m.includes("unable to validate email") || m.includes("invalid email"))
    return "E-mail inválido. Confira o endereço digitado.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde um instante e tente de novo.";
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  return "Não foi possível concluir. Tente novamente.";
}

/** Validação local de e-mail (antes de chamar o Supabase). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const MIN_PASSWORD = 8;
