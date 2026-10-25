/*
  ADMIN-2 — /admin/dados-de-teste com as abas "Dados | E-mails". /admin/emails-teste redireciona para a aba E-mails. PURO.
*/
export const ABAS_DADOS_TESTE = [
  { valor: "dados", rotulo: "Dados", href: "/admin/dados-de-teste" },
  { valor: "emails", rotulo: "E-mails", href: "/admin/dados-de-teste?aba=emails" },
] as const;
export type AbaDadosTeste = (typeof ABAS_DADOS_TESTE)[number]["valor"];

export const HREF_EMAILS_TESTE = "/admin/dados-de-teste?aba=emails";

export const abaDadosTeste = (v: unknown): AbaDadosTeste => (v === "emails" ? "emails" : "dados");
