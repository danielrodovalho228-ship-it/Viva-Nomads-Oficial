/*
  Atalho "Equipe e aprovações" no menu Perfil do app (ordem 12a8086d, item 1).
  Só aparece para role admin. Isto é conveniência de tela: quem decide o acesso
  é o servidor (layout de /admin devolve 404 a quem não é admin).
*/
export const ROTA_EQUIPE = "/admin/agentes#aprovacoes";

export function mostraEquipe(role: string | null | undefined): boolean {
  return role === "admin";
}
