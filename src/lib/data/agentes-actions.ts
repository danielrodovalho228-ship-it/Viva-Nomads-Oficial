"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chamadosEsperandoEquipe } from "@/lib/atendimento/escalonamento";
import { categoria } from "@/lib/atendimento/classificar";
import { ehAdmin } from "@/lib/data/admin-guard";
import { PREFIXO_MOACIR } from "@/lib/agentes/gerente";
import { avisoOrdem, contarP1, type Agente, type Conversa, type Ordem, type Ronda } from "@/lib/agentes/central";
import { JANELA_EVENTOS_H, montarEventos, type ChamadoEvento, type EventoRede, type FontesRede } from "@/lib/agentes/eventos";
import { eventosGithub } from "@/lib/agentes/github";
import { dispararEncaminhamentosDaSessao } from "@/lib/agentes/servidor";

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
    supabase.from("agentes_rondas").select("id, agente_slug, iniciada_em, concluida_em, status, resumo, achados, link_sessao, ordens_atendidas").order("iniciada_em", { ascending: false }).limit(200),
    supabase.from("agentes_ordens").select("*") /* "*": vale antes e depois da 0085 (colunas do disparo) */.order("criada_em", { ascending: false }).limit(100),
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

/**
 * Retorno do Moacir: execução que ELE disparou (ordem "Pedido do Moacir…")
 * terminou (a ronda fechou a ordem) → posta o resultado na conversa dele, uma
 * vez só (a linha leva "(ordem <id>)"). Roda ao abrir a Central.
 */
export async function postarRetornosDoMoacir(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return 0;
  const { data: ordens } = await supabase
    .from("agentes_ordens")
    .select("id, agente_slug, texto")
    .eq("status", "concluida")
    .like("texto", `${PREFIXO_MOACIR}%`)
    .order("atualizada_em", { ascending: false })
    .limit(10);
  let n = 0;
  for (const o of ordens ?? []) {
    const marca = `(ordem ${o.id})`;
    const { count } = await supabase.from("agentes_conversas").select("id", { count: "exact", head: true }).eq("agente_slug", "moacir").like("texto", `%${marca}%`);
    if ((count ?? 0) > 0) continue;
    const { data: r } = await supabase.from("agentes_rondas").select("resumo, link_sessao, status").contains("ordens_atendidas", [o.id]).order("iniciada_em", { ascending: false }).limit(1).maybeSingle();
    const { data: ag } = await supabase.from("agentes").select("nome").eq("slug", o.agente_slug).maybeSingle();
    const nome = (ag?.nome as string) ?? o.agente_slug;
    const texto = r
      ? `Retorno: ${nome} terminou o que eu pedi (${r.status}). ${String(r.resumo).replace(/\s+/g, " ").slice(0, 400)}${r.link_sessao ? ` ${r.link_sessao}` : ""} ${marca}`
      : `Retorno: ${nome} marcou o meu pedido como concluído, mas não achei a ronda com o resultado. Vou conferir na próxima. ${marca}`;
    const { error } = await supabase.from("agentes_conversas").insert({ agente_slug: "moacir", papel: "agente", autor_slug: "moacir", texto });
    if (!error) n++;
  }
  return n;
}

export interface ChamadoVermelho {
  id: string;
  numero: string;
  categoria: string;
  horas: number;
}

/** Chamados há 6 h ou mais sem resposta de uma pessoa da equipe (topo da Central, em vermelho). */
export async function chamadosEmVermelho(): Promise<ChamadoVermelho[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return [];
  const admin = createAdminClient();
  if (!admin) return [];
  return (await chamadosEsperandoEquipe(admin)).filter((c) => c.nivel === 6).map((c) => ({ id: c.id, numero: c.numero_publico, categoria: categoria(c.categoria)?.rotulo ?? c.categoria, horas: c.horas }));
}

/** Achados P1 nas rondas das últimas 24h — badge do item "Agentes" no menu. */
export async function contarAchadosP1(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supabase.from("agentes_rondas").select("iniciada_em, achados").gte("iniciada_em", desde).limit(500);
  return contarP1((data ?? []) as Pick<Ronda, "achados" | "iniciada_em">[], new Date());
}

/**
 * Rede ao vivo REAL: eventos das últimas 24 h (rondas, ordens, chamados, PRs e
 * deploys). A tela chama a cada 30 s; de carona, dispara os encaminhamentos P0/P1
 * que ainda não saíram (0087). Só admin (RLS is_admin() nas tabelas).
 */
export async function eventosDaRede(): Promise<{ eventos: EventoRede[]; lidoEm: string } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return null;
  await dispararEncaminhamentosDaSessao().catch(() => null);
  const agora = new Date();
  const desde = new Date(agora.getTime() - JANELA_EVENTOS_H * 3600_000).toISOString();
  const [a, r, o, c, gh] = await Promise.all([
    supabase.from("agentes").select("slug, nome"),
    supabase.from("agentes_rondas").select("agente_slug, iniciada_em, status, achados, link_sessao").gte("iniciada_em", desde).order("iniciada_em", { ascending: false }).limit(200),
    supabase.from("agentes_ordens").select("*").or(`criada_em.gte.${desde},atualizada_em.gte.${desde}`).order("criada_em", { ascending: false }).limit(200),
    supabase.from("chamado_eventos").select("acao, ator_tipo, criado_em, chamados(numero_publico)").eq("simulacao", false).gte("criado_em", desde).in("acao", ["aberto", "respondido_viva", "respondido", "sugestao_aprovada", "sugestao_editada"]).order("criado_em", { ascending: false }).limit(200),
    eventosGithub(),
  ]);
  const nomes = Object.fromEntries(((a.data ?? []) as Pick<Agente, "slug" | "nome">[]).map((x) => [x.slug, x.nome]));
  const chamados: ChamadoEvento[] = ((c.data ?? []) as { acao: string; ator_tipo: string; criado_em: string; chamados: { numero_publico: string } | { numero_publico: string }[] | null }[]).map((e) => ({
    acao: e.acao,
    ator_tipo: e.ator_tipo,
    criado_em: e.criado_em,
    numero: (Array.isArray(e.chamados) ? e.chamados[0]?.numero_publico : e.chamados?.numero_publico) ?? null,
  }));
  const fontes: FontesRede = {
    nomes,
    rondas: (r.data ?? []) as FontesRede["rondas"],
    ordens: (o.data ?? []) as FontesRede["ordens"],
    chamados,
    prs: gh.prs,
    deploys: gh.deploys,
  };
  return { eventos: montarEventos(fontes, agora).slice(0, 80), lidoEm: agora.toISOString() };
}
