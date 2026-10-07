"use server";

import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { avisoOrdem, contarP1, type Agente, type Conversa, type Ordem, type Ronda } from "@/lib/agentes/central";

/**
 * Central de Agentes — leituras e "Deixar ordem". Tudo com o cliente da sessão:
 * a RLS da 0078 (is_admin()) é quem libera; aqui só conferimos admin de novo.
 */

export interface DadosCentral {
  agentes: Agente[];
  rondas: Ronda[];
  ordens: Ordem[];
  conversas: Conversa[];
  atas: Conversa[];
}

const VAZIO: DadosCentral = { agentes: [], rondas: [], ordens: [], conversas: [], atas: [] };

export async function carregarCentral(): Promise<DadosCentral> {
  const supabase = await createClient();
  if (!supabase) return VAZIO;
  const [a, r, o, c, at] = await Promise.all([
    supabase.from("agentes").select("slug, nome, cargo, esquadrao, rotina_texto, trigger_id, status, briefing, ordem").order("ordem"),
    supabase.from("agentes_rondas").select("id, agente_slug, iniciada_em, concluida_em, status, resumo, achados, link_sessao").order("iniciada_em", { ascending: false }).limit(200),
    supabase.from("agentes_ordens").select("id, agente_slug, texto, criada_em, status, resposta").order("criada_em", { ascending: false }).limit(100),
    supabase.from("agentes_conversas").select("id, agente_slug, papel, autor_slug, texto, criado_em").not("agente_slug", "is", null).order("criado_em", { ascending: false }).limit(300),
    supabase.from("agentes_conversas").select("id, agente_slug, papel, autor_slug, texto, criado_em").is("agente_slug", null).eq("papel", "sistema").order("criado_em", { ascending: false }).limit(20),
  ]);
  return {
    agentes: (a.data ?? []) as Agente[],
    rondas: (r.data ?? []) as Ronda[],
    ordens: (o.data ?? []) as Ordem[],
    conversas: ((c.data ?? []) as Conversa[]).reverse(),
    atas: (at.data ?? []) as Conversa[],
  };
}

export async function deixarOrdem(slug: string, texto: string): Promise<{ ok: boolean; aviso?: string; erro?: string }> {
  const t = texto.trim();
  if (!t || t.length > 4000) return { ok: false, erro: "Escreva a ordem (até 4000 caracteres)." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, erro: "Só admin." };
  const { data: ag } = await supabase.from("agentes").select("nome, rotina_texto").eq("slug", slug).maybeSingle();
  if (!ag) return { ok: false, erro: "Agente não encontrado." };
  const { error } = await supabase.from("agentes_ordens").insert({ agente_slug: slug, texto: t });
  if (error) return { ok: false, erro: "Não consegui gravar a ordem." };
  return { ok: true, aviso: avisoOrdem(ag as Pick<Agente, "nome" | "rotina_texto">, new Date()) };
}

/** Achados P1 nas rondas das últimas 24h — badge do item "Agentes" no menu. */
export async function contarAchadosP1(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supabase.from("agentes_rondas").select("iniciada_em, achados").gte("iniciada_em", desde).limit(500);
  return contarP1((data ?? []) as Pick<Ronda, "achados" | "iniciada_em">[], new Date());
}
