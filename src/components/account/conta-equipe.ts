/*
  Atalho "Equipe e aprovações" (ordem 12a8086d, item 1). NAV-A (24/10): mora na barra verde do admin, não na Conta.
  Só aparece para role admin. Isto é conveniência de tela: quem decide o acesso
  é o servidor (layout de /admin devolve 404 a quem não é admin).
*/
/** Painel /admin (números e atalhos), acima de "Equipe e aprovações" na barra verde do admin. */
export const ROTA_ADMIN = "/admin";
// ADMIN-2: Aprovações é aba da Central de Agentes (o antigo #aprovacoes abre a mesma aba).
export const ROTA_EQUIPE = "/admin/agentes?aba=aprovacoes";

export function mostraEquipe(role: string | null | undefined): boolean {
  return role === "admin";
}
