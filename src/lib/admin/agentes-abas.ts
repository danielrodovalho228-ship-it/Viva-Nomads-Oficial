/*
  ADMIN-2 — abas da Central de Agentes. "Aprovações" deixou de ser uma faixa fixa no topo e virou aba:
  /admin/agentes?aba=aprovacoes. O link antigo /admin/agentes#aprovacoes abre a mesma aba. PURO.
*/
export const ABAS_AGENTES = ["Equipe", "Aprovações", "Rede ao vivo", "Raio-X da Viva", "Diário de bordo", "Conversar", "Sala de reunião"] as const;
export type AbaAgentes = (typeof ABAS_AGENTES)[number];

export const HREF_APROVACOES = "/admin/agentes?aba=aprovacoes";

/** A aba pedida pela URL (?aba=aprovacoes ou o antigo #aprovacoes); o resto abre a Equipe. */
export function abaDaUrl(aba: string | null | undefined, hash?: string | null): AbaAgentes {
  if (aba === "aprovacoes" || (hash ?? "").replace(/^#/, "") === "aprovacoes") return "Aprovações";
  return "Equipe";
}
