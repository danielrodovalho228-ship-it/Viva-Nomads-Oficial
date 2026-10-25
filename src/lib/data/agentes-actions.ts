"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chamadosEsperandoEquipe } from "@/lib/atendimento/escalonamento";
import { categoria } from "@/lib/atendimento/classificar";
import { ehAdmin } from "@/lib/data/admin-guard";
import { contarAguardandoOk } from "@/lib/data/admin-indicadores";
import { PREFIXO_MOACIR } from "@/lib/agentes/gerente";
import { revalidatePath } from "next/cache";
import { avisoOrdem, contarP1, type Agente, type Conversa, type Ordem, type Ronda } from "@/lib/agentes/central";
import { JANELA_EVENTOS_H, montarEventos, type ChamadoEvento, type EventoRede, type FontesRede } from "@/lib/agentes/eventos";
import { eventosGithub } from "@/lib/agentes/github";
import { textoReaberto, validarReabertura } from "@/lib/agentes/aceite-ordem";
import { dispararEncaminhamentosDaSessao } from "@/lib/agentes/servidor";

/**
 * Central de Agentes — leituras e "Deixar ordem". Tudo com o cliente da sessão:
 * a RLS da 0078 (is_admin()) é quem libera; aqui só conferimos admin de novo.
 */

export interface DadosCentral {
  agentes: Agente[];
  rondas: Ronda[];
  ordens: Ordem[];
  /** Quem está logado: só o criador da ordem vê Aceito/Reabrir (a ação e o gatilho do banco conferem de novo). */
  uid: string | null;
  /**
   * E74: a RLS das tabelas de agentes (is_admin()) libera ESTA sessão? Sem a verificação em duas etapas da sessão, as
   * leituras voltam vazias sem erro — a tela precisa saber a diferença entre "não há agentes" e "não dá para ler".
   */
  acessoLiberado: boolean;
}

const VAZIO: DadosCentral = { agentes: [], rondas: [], ordens: [], uid: null, acessoLiberado: false };

/** ADMIN-5: uma página do chat ou das atas (o mais novo primeiro no banco; devolvido em ordem de leitura). */
export interface PaginaConversas {
  itens: Conversa[];
  /** Há mensagens mais antigas que a primeira desta página. */
  temMais: boolean;
}
const POR_PAGINA_CHAT = 50;
const POR_PAGINA_ATAS = 10;
const CAMPOS_CONVERSA = "id, agente_slug, papel, autor_slug, texto, criado_em";
const ehIso = (v: string | null | undefined): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

export async function carregarCentral(): Promise<DadosCentral> {
  const supabase = await createClient();
  if (!supabase) return VAZIO;
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  // ADMIN-5: o chat e as atas não vêm aqui; cada aba lê a sua página quando abre (carregarConversas / carregarAtas).
  const [a, r, o, adm] = await Promise.all([
    supabase.from("agentes").select("slug, nome, cargo, esquadrao, rotina_texto, trigger_id, status, briefing, ordem").order("ordem"),
    supabase.from("agentes_rondas").select("id, agente_slug, iniciada_em, concluida_em, status, resumo, achados, link_sessao, ordens_atendidas").order("iniciada_em", { ascending: false }).limit(200),
    supabase.from("agentes_ordens").select("*") /* "*": vale antes e depois da 0085 (colunas do disparo) */.order("criada_em", { ascending: false }).limit(100),
    supabase.rpc("is_admin"),
  ]);
  return {
    agentes: (a.data ?? []) as Agente[],
    rondas: (r.data ?? []) as Ronda[],
    ordens: (o.data ?? []) as Ordem[],
    uid,
    acessoLiberado: adm.data === true,
  };
}

/** ADMIN-5: o chat com UM agente, 50 mensagens por vez; "antesDe" pede a página anterior. RLS is_admin() decide. */
export async function carregarConversas(slug: string, antesDe?: string | null): Promise<PaginaConversas> {
  const supabase = await createClient();
  if (!supabase || !/^[a-z0-9-]{1,40}$/.test(slug)) return { itens: [], temMais: false };
  let q = supabase.from("agentes_conversas").select(CAMPOS_CONVERSA).eq("agente_slug", slug).order("criado_em", { ascending: false }).limit(POR_PAGINA_CHAT + 1);
  if (ehIso(antesDe)) q = q.lt("criado_em", antesDe);
  const { data } = await q;
  const linhas = (data ?? []) as Conversa[];
  return { itens: linhas.slice(0, POR_PAGINA_CHAT).reverse(), temMais: linhas.length > POR_PAGINA_CHAT };
}

/** ADMIN-5: as atas da Sala de reunião, 10 por vez (a mais nova primeiro). */
export async function carregarAtas(antesDe?: string | null): Promise<PaginaConversas> {
  const supabase = await createClient();
  if (!supabase) return { itens: [], temMais: false };
  let q = supabase.from("agentes_conversas").select(CAMPOS_CONVERSA).is("agente_slug", null).eq("papel", "sistema").order("criado_em", { ascending: false }).limit(POR_PAGINA_ATAS + 1);
  if (ehIso(antesDe)) q = q.lt("criado_em", antesDe);
  const { data } = await q;
  const linhas = (data ?? []) as Conversa[];
  return { itens: linhas.slice(0, POR_PAGINA_ATAS), temMais: linhas.length > POR_PAGINA_ATAS };
}

/**
 * Aceite do sócio nas ordens (ordem 3c3d8a9e, parte 2): só QUEM CRIOU a ordem a aceita ("Aceito") ou reabre dizendo o que falta.
 * A condição vai no próprio UPDATE (criado_por = quem está logado, concluída, sem aceite) e o gatilho da 0209 repete a regra.
 * Reabrir devolve a ordem a "pendente" com o que falta no fim do texto, que é o que o agente lê.
 */
export async function responderAceiteOrdem(id: string, decisao: "aceitar" | "reabrir", falta?: string): Promise<{ ok: boolean; erro?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, erro: "Ordem inválida." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, erro: "Só admin." };
  const agora = new Date().toISOString();
  let mudanca: Record<string, unknown>;
  if (decisao === "aceitar") {
    mudanca = { aceito_por: user.id, aceito_em: agora };
  } else {
    const v = validarReabertura(falta);
    if (!v.ok) return { ok: false, erro: v.erro };
    const { data: atual } = await supabase.from("agentes_ordens").select("texto").eq("id", id).eq("criado_por", user.id).maybeSingle();
    if (!atual) return { ok: false, erro: "Só quem criou a ordem aceita ou reabre." };
    mudanca = {
      status: "pendente",
      texto: textoReaberto(String(atual.texto), v.falta),
      reaberto_em: agora,
      reaberto_motivo: v.falta,
      aceito_por: null,
      aceito_em: null,
      disparada_em: null,
      sessao_url: null,
      disparo_erro: null,
    };
  }
  const { data, error } = await supabase
    .from("agentes_ordens")
    .update(mudanca)
    .eq("id", id)
    .eq("criado_por", user.id)
    .eq("status", "concluida")
    .is("aceito_em", null)
    .select("id");
  if (error) return { ok: false, erro: "Não foi possível registrar agora." };
  if (!data?.length) return { ok: false, erro: "Só quem criou a ordem aceita ou reabre, e só enquanto ela aguarda o aceite." };
  revalidatePath("/admin/agentes");
  revalidatePath("/admin");
  return { ok: true };
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

/**
 * Aprovações que esperam o OK do Daniel — badge do item "Agentes" no menu (mesma regra
 * dos cartões do chat: pendentes e dentro do prazo). Só admin; os demais recebem 0.
 */
export async function contarAprovacoesPendentes(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return 0;
  // Prompt 29, item 10: a MESMA função de "Aguardando o seu OK" da página de Agentes e da home.
  const admin = createAdminClient();
  return admin ? contarAguardandoOk(admin) : 0;
}

/** Achados P1 nas rondas das últimas 24h (número informativo; NÃO é o badge do menu). */
export async function contarAchadosP1(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supabase.from("agentes_rondas").select("iniciada_em, achados").gte("iniciada_em", desde).limit(500);
  return contarP1((data ?? []) as Pick<Ronda, "achados" | "iniciada_em">[], new Date());
}

/**
 * Rede ao vivo REAL: eventos das últimas 24 h (rondas, ordens, chamados, PRs e
 * deploys). A tela chama a cada 15 s; de carona, dispara os encaminhamentos P0/P1
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
    supabase.from("chamado_eventos").select("acao, ator_tipo, criado_em, chamados(numero_publico)").eq("simulacao", false).gte("criado_em", desde).in("acao", ["aberto", "respondido_viva", "sugestao_ia", "erro_tecnico", "pediu_humano", "respondido", "sugestao_aprovada", "sugestao_editada"]).order("criado_em", { ascending: false }).limit(200),
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
