/**
 * FONTE ÚNICA do nome exibível do usuário (ADENDO responsividade, item 3).
 *
 * Regra definitiva, aplicada NA FONTE (não tela a tela — foi por isso que o
 * e-mail cru reapareceu no checklist depois de uma correção local):
 *  • recebe o nome completo (profiles.full_name) e devolve o PRIMEIRO nome;
 *  • valor vazio → "" e a UI cai numa saudação NEUTRA, sem identificador
 *    ("Comece por aqui 👋"), nunca "Olá, <e-mail>";
 *  • valor que PARECE e-mail (contém "@") → tratado como sem-nome. Assim, mesmo
 *    que o full_name tenha sido poluído com o e-mail em algum fluxo antigo, o
 *    login cru JAMAIS chega à tela ou ao e-mail transacional.
 *
 * Sem "use client": vale no servidor (e-mails transacionais) e no cliente
 * (casca do painel). Todo lugar que saúda/exibe o usuário passa por aqui.
 */
export function primeiroNome(nomeCompleto: string | null | undefined): string {
  const n = nomeCompleto?.trim();
  if (!n || n.includes("@")) return "";
  return n.split(/\s+/)[0];
}

/**
 * "Usuário" do e-mail: a parte antes do "@". Identifica o dono da conta sem
 * expor o e-mail inteiro — usado como fallback amigável quando não há nome
 * próprio (rodapé/avatar). "" se não houver e-mail válido.
 */
export function usuarioDoEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  const at = e.indexOf("@");
  return at > 0 ? e.slice(0, at) : "";
}

/**
 * Nome completo para EDIÇÃO (campo "Nome completo" da Conta): devolve o nome
 * como está, exceto quando o valor foi poluído com o e-mail em algum fluxo
 * antigo (contém "@") — nesse caso devolve "" para o campo convidar o nome real,
 * em vez de exibir o e-mail como se fosse o nome.
 */
export function nomeCompletoLimpo(fullName: string | null | undefined): string {
  const n = (fullName ?? "").trim();
  return n.includes("@") ? "" : n;
}

/** Formato mínimo de perfil aceito pelo util (qualquer origem de nome). */
export interface PerfilNome {
  fullName?: string | null;
  full_name?: string | null;
  name?: string | null;
}

/**
 * FONTE ÚNICA (assinatura pedida no fechamento do QA): recebe um perfil e
 * devolve o PRIMEIRO nome, ou `null` quando não há nome próprio — o chamador
 * usa uma saudação NEUTRA (nunca e-mail, nunca persona fictícia). O campo
 * `name` (que pode carregar o e-mail como fallback técnico) é passado pelo
 * mesmo filtro de `primeiroNome`, então um e-mail vira `null`.
 */
export function displayName(profile: PerfilNome | null | undefined): string | null {
  if (!profile) return null;
  const bruto = profile.fullName ?? profile.full_name ?? profile.name ?? null;
  const nome = primeiroNome(bruto);
  return nome || null;
}
