"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  camposTransicao,
  descricaoEvento,
  linhaParaOrdem,
  proximosStatus,
  STATUS_CONTRATO_COM_MANUTENCAO,
  validarMensagem,
  type EventoOrdem,
  type LinhaOrdem,
  type PapelOrdem,
} from "@/lib/manutencao-solicitacoes";
import type { ServiceOrder, SOStatus } from "@/lib/service-orders";
import { consumirLimite } from "@/lib/limites";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { notify } from "@/lib/notifications";
import { notificacaoLigada } from "@/lib/notifications/preferencias";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ContratoManutencao {
  id: string;
  titulo: string;
}

export interface MinhasSolicitacoes {
  /** null = sem sessão ou sem banco (demonstração): a tela usa os exemplos. */
  comoInquilino: ServiceOrder[];
  comoDono: ServiceOrder[];
  contratos: ContratoManutencao[];
}

/**
 * Chamados REAIS da pessoa: os que ela abriu (inquilino) e os dos seus imóveis
 * (dono). A leitura passa pelo RLS (service_orders: só as partes). Contratos
 * ativos = onde a manutenção pode ser pedida.
 */
export async function minhasSolicitacoes(): Promise<MinhasSolicitacoes | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const colunas = "id, category, priority, description, status, opened_at, first_response_at, resolved_at, tenant_id, owner_id, properties(title)";
  const { data: linhas } = await supabase
    .from("service_orders")
    .select(colunas)
    .or(`tenant_id.eq.${user.id},owner_id.eq.${user.id}`)
    .order("opened_at", { ascending: false })
    .limit(200);
  const todas = (linhas ?? []) as unknown as (LinhaOrdem & { tenant_id: string; owner_id: string })[];

  // Nome do inquilino só para o dono daquele imóvel (o contrato ativo já foi aceito).
  const nomes = new Map<string, string>();
  const idsInquilino = [...new Set(todas.filter((l) => l.owner_id === user.id && l.tenant_id !== user.id).map((l) => l.tenant_id))];
  const admin = createAdminClient();
  if (admin && idsInquilino.length) {
    const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", idsInquilino);
    for (const p of perfis ?? []) if (p.full_name) nomes.set(p.id as string, p.full_name as string);
  }

  const comoInquilino = todas.filter((l) => l.tenant_id === user.id).map((l) => linhaParaOrdem(l));
  const comoDono = todas
    .filter((l) => l.owner_id === user.id)
    .map((l) => linhaParaOrdem({ ...l, tenant_name: nomes.get(l.tenant_id) ?? null }));

  let contratos: ContratoManutencao[] = [];
  if (admin) {
    const { data: cts } = await admin
      .from("contratos")
      .select("id, properties(title)")
      .eq("tenant_id", user.id)
      .in("status", [...STATUS_CONTRATO_COM_MANUTENCAO])
      .limit(20);
    contratos = (cts ?? []).map((c) => ({ id: c.id as string, titulo: (c.properties as unknown as { title?: string } | null)?.title?.trim() || "Meu imóvel" }));
  }
  return { comoInquilino, comoDono, contratos };
}

const COLUNAS_ORDEM = "id, category, priority, description, status, opened_at, first_response_at, resolved_at, tenant_id, owner_id, properties(title)";

type Sessao = { supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>; uid: string };

async function sessao(): Promise<Sessao | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, uid: user.id } : null;
}

type OrdemDaParte = LinhaOrdem & { tenant_id: string; owner_id: string };

/** A ordem, lida PELO RLS (só as partes enxergam) + o lado de quem pede. */
async function ordemDaParte(s: Sessao, id: string): Promise<{ ordem: OrdemDaParte; papel: PapelOrdem } | null> {
  const { data } = await s.supabase.from("service_orders").select(COLUNAS_ORDEM).eq("id", id).maybeSingle();
  const ordem = data as unknown as OrdemDaParte | null;
  if (!ordem) return null;
  if (ordem.owner_id === s.uid) return { ordem, papel: "proprietario" };
  if (ordem.tenant_id === s.uid) return { ordem, papel: "inquilino" };
  return null;
}

/** Avisa a OUTRA parte (e-mail se ligado — sem preferência salva = ligado — e push). Nunca lança. */
async function avisarOutraParte(ordem: OrdemDaParte, papel: PapelOrdem, evento: "manutencao_atualizada" | "manutencao_mensagem") {
  const admin = createAdminClient();
  if (!admin) return;
  const destino = papel === "proprietario" ? ordem.tenant_id : ordem.owner_id;
  const { data: p } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", destino).maybeSingle();
  await notify({
    event: evento,
    email: p?.email && notificacaoLigada(p.notif_email as boolean | null) ? (p.email as string) : undefined,
    name: (p?.full_name as string) ?? undefined,
    userId: destino,
    pushUrl: "/dashboard/solicitacoes",
  }).catch(() => null);
}

export interface MensagemOrdem {
  id: string;
  autor: "voce" | PapelOrdem;
  texto: string;
  criadoEm: string;
}

export interface DetalheOrdem {
  papel: PapelOrdem;
  acoes: SOStatus[];
  eventos: EventoOrdem[];
  mensagens: MensagemOrdem[];
}

/** Histórico (data/hora de cada mudança) e mensagens da ordem — só para as partes. */
export async function detalheSolicitacao(id: string): Promise<{ ok: true; detalhe: DetalheOrdem } | { ok: false; error: string }> {
  if (!UUID_RE.test(id ?? "")) return { ok: false, error: "Solicitação inválida." };
  const s = await sessao();
  if (!s) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const alvo = await ordemDaParte(s, id);
  if (!alvo) return { ok: false, error: "Solicitação não encontrada." };
  const [{ data: evs }, { data: msgs }] = await Promise.all([
    s.supabase.from("service_order_eventos").select("tipo, papel, status_para, criado_em").eq("service_order_id", id).order("criado_em").limit(100),
    s.supabase.from("service_order_messages").select("id, sender_id, body, created_at").eq("service_order_id", id).order("created_at").limit(200),
  ]);
  const eventos: EventoOrdem[] = (evs ?? []).map((e) => ({
    tipo: e.tipo === "aberto" ? "aberto" : "status",
    papel: (["inquilino", "proprietario"].includes(e.papel as string) ? e.papel : "sistema") as EventoOrdem["papel"],
    statusPara: (e.status_para as string | null) ?? null,
    criadoEm: e.criado_em as string,
  }));
  // Nenhum nome nem id de quem escreveu: só "você" ou o lado (inquilino/proprietário).
  const mensagens: MensagemOrdem[] = (msgs ?? []).map((m) => ({
    id: m.id as string,
    autor: m.sender_id === s.uid ? "voce" : m.sender_id === alvo.ordem.owner_id ? "proprietario" : "inquilino",
    texto: m.body as string,
    criadoEm: m.created_at as string,
  }));
  return { ok: true, detalhe: { papel: alvo.papel, acoes: proximosStatus(alvo.ordem.status as SOStatus, alvo.papel), eventos, mensagens } };
}

/**
 * Muda o status (critério 4). Proprietário: Aberta → Em atendimento → Resolvida,
 * gravado pelo RLS ("proprietário atualiza status"). Inquilino: só "Resolvida",
 * gravado pelo servidor depois de conferir que a ordem é dele. Todo passo entra
 * no histórico com data/hora e a outra parte é avisada.
 */
export async function mudarStatusSolicitacao(
  id: string,
  novo: SOStatus
): Promise<{ ok: true; ordem: ServiceOrder } | { ok: false; error: string }> {
  if (!UUID_RE.test(id ?? "")) return { ok: false, error: "Solicitação inválida." };
  if (!["em_andamento", "resolvido"].includes(novo)) return { ok: false, error: "Status inválido." };
  const s = await sessao();
  if (!s) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Indisponível no momento." };
  const alvo = await ordemDaParte(s, id);
  if (!alvo) return { ok: false, error: "Solicitação não encontrada." };
  const { ordem, papel } = alvo;
  const atual = ordem.status as SOStatus;
  const campos = camposTransicao(atual, novo, papel, ordem.first_response_at, new Date());
  if (!campos) return { ok: false, error: atual === "resolvido" ? "Esta solicitação já foi resolvida." : "Esta mudança não é permitida." };

  // `.eq("status", atual)`: se a outra parte mudou no meio-tempo, nada é gravado.
  const { data: nova, error } =
    papel === "proprietario"
      ? await s.supabase.from("service_orders").update(campos).eq("id", id).eq("owner_id", s.uid).eq("status", atual).select(COLUNAS_ORDEM).maybeSingle()
      : await admin.from("service_orders").update(campos).eq("id", id).eq("tenant_id", s.uid).eq("status", atual).select(COLUNAS_ORDEM).maybeSingle();
  if (error || !nova) {
    if (error) console.error("[mudarStatusSolicitacao]", error.code, error.message);
    return { ok: false, error: "Não foi possível atualizar agora. Recarregue e tente de novo." };
  }
  const { error: eHist } = await admin
    .from("service_order_eventos")
    .insert({ service_order_id: id, ator_id: s.uid, papel, tipo: "status", status_de: atual, status_para: novo });
  if (eHist) console.error("[mudarStatusSolicitacao] histórico", eHist.code);
  await avisarOutraParte(ordem, papel, "manutencao_atualizada");
  revalidatePath("/dashboard/solicitacoes");
  return { ok: true, ordem: linhaParaOrdem(nova as unknown as LinhaOrdem) };
}

/** Réplica dentro da ordem (critério 4): qualquer das partes escreve; a outra é avisada. */
export async function responderSolicitacao(id: string, texto: string): Promise<{ ok: true; mensagem: MensagemOrdem } | { ok: false; error: string }> {
  if (!UUID_RE.test(id ?? "")) return { ok: false, error: "Solicitação inválida." };
  const v = validarMensagem(texto);
  if (!v.ok) return { ok: false, error: v.erro };
  const s = await sessao();
  if (!s) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Indisponível no momento." };
  const alvo = await ordemDaParte(s, id);
  if (!alvo) return { ok: false, error: "Solicitação não encontrada." };
  if (!(await consumirLimite(`manutencao-msg:${s.uid}`, 30, 3600))) return { ok: false, error: "Muitas mensagens em pouco tempo. Tente de novo mais tarde." };

  const body = guardContactInfo(v.texto).text;
  const { data: m, error } = await admin
    .from("service_order_messages")
    .insert({ service_order_id: id, sender_id: s.uid, body })
    .select("id, created_at")
    .single();
  if (error || !m) {
    console.error("[responderSolicitacao]", error?.code, error?.message);
    return { ok: false, error: "Não foi possível enviar agora. Tente de novo." };
  }
  // A primeira mensagem do proprietário conta como a primeira resposta (prazo cumprido).
  if (alvo.papel === "proprietario" && !alvo.ordem.first_response_at) {
    await admin.from("service_orders").update({ first_response_at: m.created_at }).eq("id", id).is("first_response_at", null);
  }
  await avisarOutraParte(alvo.ordem, alvo.papel, "manutencao_mensagem");
  revalidatePath("/dashboard/solicitacoes");
  return { ok: true, mensagem: { id: m.id as string, autor: "voce", texto: body, criadoEm: m.created_at as string } };
}

export interface AvisoRecente {
  id: string;
  ordemId: string;
  imovel: string;
  texto: string;
  criadoEm: string;
}

/** /dashboard/notificacoes: últimas atualizações das ordens da pessoa (histórico + mensagens da outra parte). */
export async function avisosRecentes(): Promise<{ abertas: number; avisos: AvisoRecente[] } | null> {
  const s = await sessao();
  if (!s) return null;
  const { data: ordens } = await s.supabase
    .from("service_orders")
    .select("id, status, tenant_id, owner_id, properties(title)")
    .or(`tenant_id.eq.${s.uid},owner_id.eq.${s.uid}`)
    .order("opened_at", { ascending: false })
    .limit(50);
  const lista = (ordens ?? []) as unknown as { id: string; status: string; properties: { title?: string } | null }[];
  if (!lista.length) return { abertas: 0, avisos: [] };
  const ids = lista.map((o) => o.id);
  const titulo = new Map(lista.map((o) => [o.id, o.properties?.title?.trim() || "Imóvel"]));
  const [{ data: evs }, { data: msgs }] = await Promise.all([
    s.supabase.from("service_order_eventos").select("id, service_order_id, tipo, papel, status_para, ator_id, criado_em").in("service_order_id", ids).order("criado_em", { ascending: false }).limit(30),
    s.supabase.from("service_order_messages").select("id, service_order_id, sender_id, created_at").in("service_order_id", ids).neq("sender_id", s.uid).order("created_at", { ascending: false }).limit(30),
  ]);
  const avisos: AvisoRecente[] = [
    ...(evs ?? []).map((e) => ({
      id: `e-${e.id}`,
      ordemId: e.service_order_id as string,
      imovel: titulo.get(e.service_order_id as string) ?? "Imóvel",
      texto: descricaoEvento({
        tipo: e.tipo === "aberto" ? "aberto" : "status",
        papel: (["inquilino", "proprietario"].includes(e.papel as string) ? e.papel : "sistema") as EventoOrdem["papel"],
        statusPara: (e.status_para as string | null) ?? null,
        criadoEm: e.criado_em as string,
      }),
      criadoEm: e.criado_em as string,
    })),
    ...(msgs ?? []).map((m) => ({
      id: `m-${m.id}`,
      ordemId: m.service_order_id as string,
      imovel: titulo.get(m.service_order_id as string) ?? "Imóvel",
      texto: "Nova mensagem na ordem de manutenção",
      criadoEm: m.created_at as string,
    })),
  ]
    .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm))
    .slice(0, 20);
  return { abertas: lista.filter((o) => o.status !== "resolvido").length, avisos };
}
