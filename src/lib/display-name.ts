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
