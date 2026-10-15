/**
 * Login no celular (ordem c27c7ae6): atributos do campo de e-mail para o iPhone
 * não capitalizar/corrigir, limpeza do valor e reconhecimento de prefetch no proxy.
 */

/** Evita "Ana@..." e autocorreção no iOS, que gera "credenciais inválidas". */
export const ATRIBUTOS_EMAIL = {
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
  inputMode: "email",
} as const;

/** Tira espaços das pontas (o teclado do iPhone costuma deixar um após a sugestão). */
export function limparEmail(valor: string): string {
  return valor.trim();
}

/** Requisição de pré-carregamento do Next/navegador (não é navegação de verdade). */
export function requisicaoPrefetch(headers: { get(nome: string): string | null }): boolean {
  if (headers.get("next-router-prefetch")) return true;
  const finalidade = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`;
  return /prefetch/i.test(finalidade);
}

/** Há cookie de sessão do Supabase? Checagem local, sem chamar a rede. */
export function temCookieSessao(cookies: ReadonlyArray<{ name: string }>): boolean {
  return cookies.some((c) => /^sb-.+-auth-token/.test(c.name));
}

/**
 * Visitante sem cookie de sessão não tem usuário: dispensa a ida ao servidor de
 * autenticação (getUser) no proxy — era uma viagem de rede em TODA página pública
 * (ordem 0f66a754). Com cookie, a verificação segue igual.
 */
export function precisaVerificarUsuario(cookies: ReadonlyArray<{ name: string }>): boolean {
  return temCookieSessao(cookies);
}
