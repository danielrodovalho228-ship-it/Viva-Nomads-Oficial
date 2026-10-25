import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversa } from "@/lib/agentes/central";

/*
  ADMIN-5 — o chat e as atas da Central de Agentes, lidos SÓ quando a aba abre, uma página por vez. Leitura por rota
  GET (/api/admin/agentes/conversas), não por Server Action: ação em andamento junto com o router.refresh da Central
  recarregava a página inteira. Cliente da sessão: a RLS is_admin() (0078) decide.
*/
export interface PaginaConversas {
  itens: Conversa[];
  /** Há mensagens mais antigas que a primeira desta página. */
  temMais: boolean;
}
export const POR_PAGINA_CHAT = 50;
export const POR_PAGINA_ATAS = 10;
const CAMPOS = "id, agente_slug, papel, autor_slug, texto, criado_em";
const ehIso = (v: string | null | undefined): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
export const slugValido = (s: string | null | undefined): s is string => typeof s === "string" && /^[a-z0-9-]{1,40}$/.test(s);

/** O chat com UM agente, 50 por vez (em ordem de leitura); "antesDe" pede a página anterior. */
export async function lerConversas(db: SupabaseClient, slug: string, antesDe?: string | null): Promise<PaginaConversas> {
  let q = db.from("agentes_conversas").select(CAMPOS).eq("agente_slug", slug).order("criado_em", { ascending: false }).limit(POR_PAGINA_CHAT + 1);
  if (ehIso(antesDe)) q = q.lt("criado_em", antesDe);
  const { data } = await q;
  const linhas = (data ?? []) as Conversa[];
  return { itens: linhas.slice(0, POR_PAGINA_CHAT).reverse(), temMais: linhas.length > POR_PAGINA_CHAT };
}

/** As atas da Sala de reunião, 10 por vez (a mais nova primeiro). */
export async function lerAtas(db: SupabaseClient, antesDe?: string | null): Promise<PaginaConversas> {
  let q = db.from("agentes_conversas").select(CAMPOS).is("agente_slug", null).eq("papel", "sistema").order("criado_em", { ascending: false }).limit(POR_PAGINA_ATAS + 1);
  if (ehIso(antesDe)) q = q.lt("criado_em", antesDe);
  const { data } = await q;
  const linhas = (data ?? []) as Conversa[];
  return { itens: linhas.slice(0, POR_PAGINA_ATAS), temMais: linhas.length > POR_PAGINA_ATAS };
}
