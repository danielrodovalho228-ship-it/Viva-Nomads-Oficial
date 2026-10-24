import type { SupabaseClient } from "@supabase/supabase-js";
import { notify, type NotificationEvent } from "@/lib/notifications";
import { hojeEmBrasilia } from "@/lib/checkin";
import { STATUS_TESTE_CONCLUIDO } from "./entrada";
import {
  designacaoVencida,
  proximoAvaliador,
  sorteadoParaAuditoria,
  suspendePorAusencias,
  visitaAmanha,
  type AvaliadorFila,
  type HistoricoDesignacao,
  type PedidoParaDesignar,
  type StatusCredenciamento,
  type TipoPedido,
} from "./regras";

/*
  Prompt 62-B1 — o lado do servidor da avaliação do imóvel: lê a fila da cidade e o histórico, pede à regra pura o
  próximo avaliador e grava a designação. Roda com o cliente de serviço (ações depois do portão de cada parte, e o cron).
  Nunca lança: aviso é complemento. O dono nunca escolhe o avaliador: nenhuma função aqui recebe avaliador do dono.
*/

type Admin = SupabaseClient;

export const ROTA_AVALIADOR = "/dashboard/parceiro/avaliacao";
export const rotaDono = (propertyId: string) => `/dashboard/imoveis/${propertyId}/nivel#avaliacao`;
export const rotaMorador = (pedidoId: string) => `/dashboard/avaliacao-imovel/${pedidoId}`;
export const ROTA_ADMIN = "/admin/avaliadores";

export async function avisar(admin: Admin, destino: string | null | undefined, ev: NotificationEvent, url: string): Promise<void> {
  if (!destino) return;
  try {
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", destino).maybeSingle();
    const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    await notify({ event: ev, email: d?.notif_email === false ? undefined : (d?.email ?? undefined), name: d?.full_name ?? undefined, userId: destino, pushUrl: url });
  } catch {
    /* aviso é complemento */
  }
}

export async function avisarAdmins(admin: Admin, ev: NotificationEvent): Promise<void> {
  try {
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    for (const ad of (admins ?? []) as { id: string }[]) {
      const { data: u } = await admin.auth.admin.getUserById(ad.id);
      await notify({ event: ev, email: u?.user?.email ?? undefined, userId: ad.id, pushUrl: ROTA_ADMIN, interno: true });
    }
  } catch {
    /* best-effort */
  }
}

/** Item na fila do admin (um aberto por tipo e referência). */
export async function naFilaDoAdmin(admin: Admin, tipo: "sem_avaliador" | "avaliacao_teste" | "suspensao_automatica" | "proposta_descredenciamento", ref: { pedidoId?: string; avaliadorId?: string }, motivo: string): Promise<void> {
  await admin.from("vistoria_fila_admin").insert({ tipo, pedido_id: ref.pedidoId ?? null, avaliador_id: ref.avaliadorId ?? null, motivo });
}

type LinhaCred = {
  id: string;
  cidade: string;
  status: StatusCredenciamento;
  criado_em: string;
  ativado_em: string | null;
  ultima_designacao_em: string | null;
  relacoes_donos: string[] | null;
  relacoes_imoveis: string[] | null;
  parceiros: { user_id: string } | null;
};

/** A fila da cidade (todos os credenciamentos; a regra pura decide quem pode). */
export async function filaDaCidade(admin: Admin): Promise<AvaliadorFila[]> {
  const { data } = await admin
    .from("avaliadores_credenciamento")
    .select("id, cidade, status, criado_em, ativado_em, ultima_designacao_em, relacoes_donos, relacoes_imoveis, parceiros(user_id)")
    .in("status", ["em_teste", "ativo", "suspenso"]);
  const linhas = (data ?? []) as unknown as LinhaCred[];
  const ids = linhas.map((l) => l.parceiros?.user_id).filter((x): x is string => !!x);
  const { data: perfis } = ids.length ? await admin.from("profiles").select("id, is_teste").in("id", ids) : { data: [] };
  const teste = new Set(((perfis ?? []) as { id: string; is_teste: boolean | null }[]).filter((p) => p.is_teste).map((p) => p.id));
  return linhas
    .filter((l) => l.parceiros?.user_id)
    .map((l) => ({
      id: l.id,
      userId: l.parceiros!.user_id,
      cidade: l.cidade,
      status: l.status,
      teste: teste.has(l.parceiros!.user_id),
      credenciadoEm: l.ativado_em ?? l.criado_em,
      ultimaDesignacaoEm: l.ultima_designacao_em,
      relacoesDonos: l.relacoes_donos ?? [],
      relacoesImoveis: l.relacoes_imoveis ?? [],
    }));
}

/**
 * Histórico para os impedimentos: serviços prestados ao dono (pedidos de parceiro do 31b e vínculo fixo do 38, nos dois
 * casos ligados à conta do parceiro) e as avaliações anteriores do imóvel. Os pedidos do catálogo antigo de serviços e
 * dos fotógrafos antigos não têm a conta do prestador gravada e não entram (ver o PR).
 */
export async function historicoDoPedido(admin: Admin, ownerId: string, propertyId: string): Promise<HistoricoDesignacao> {
  const [pedidos, vinculos, avaliacoes] = await Promise.all([
    admin.from("parceiro_pedidos").select("criado_em, status, parceiros(user_id)").eq("cliente_id", ownerId).not("status", "in", "(recusado,cancelado)"),
    admin.from("imovel_parceiros").select("criado_em, respondido_em, status, parceiros(user_id), properties!inner(owner_id)").eq("properties.owner_id", ownerId).in("status", ["ativo", "encerrado"]),
    admin.from("vistoria_pedidos").select("avaliador_id, criado_em, status").eq("property_id", propertyId).in("status", ["realizada", "laudo_emitido"]).not("avaliador_id", "is", null).order("criado_em", { ascending: true }),
  ]);
  type P = { criado_em: string; respondido_em?: string | null; parceiros: { user_id: string } | null };
  const servicos = [...((pedidos.data ?? []) as unknown as P[]), ...((vinculos.data ?? []) as unknown as P[])]
    .filter((p) => p.parceiros?.user_id)
    .map((p) => ({ userId: p.parceiros!.user_id, ownerId, em: p.respondido_em ?? p.criado_em }));
  return {
    servicosAoDono: servicos,
    avaliacoesDoImovel: ((avaliacoes.data ?? []) as { avaliador_id: string; criado_em: string }[]).map((a) => ({ avaliadorId: a.avaliador_id, em: a.criado_em })),
  };
}

type LinhaPedido = {
  id: string;
  property_id: string;
  owner_id: string;
  cidade: string;
  tipo: TipoPedido;
  teste: boolean;
  status: string;
  origem_pedido_id: string | null;
};

/**
 * Designa o próximo avaliador elegível (rodízio). Sem ninguém: o pedido fica "aguardando avaliador" e o admin é avisado.
 * Devolve o id do credenciamento designado (ou null).
 */
export async function designar(admin: Admin, pedidoId: string, agora = new Date()): Promise<string | null> {
  const { data } = await admin.from("vistoria_pedidos").select("id, property_id, owner_id, cidade, tipo, teste, status, origem_pedido_id").eq("id", pedidoId).maybeSingle();
  const p = data as LinhaPedido | null;
  if (!p || !["pedido", "designado"].includes(p.status)) return null;
  const [{ data: ja }, fila, historico] = await Promise.all([
    admin.from("vistoria_designacoes").select("avaliador_id").eq("pedido_id", p.id),
    filaDaCidade(admin),
    historicoDoPedido(admin, p.owner_id, p.property_id),
  ]);
  let primeiro: string | null = null;
  if (p.tipo === "contestacao" && p.origem_pedido_id) {
    const { data: o } = await admin.from("vistoria_pedidos").select("avaliador_id").eq("id", p.origem_pedido_id).maybeSingle();
    primeiro = (o?.avaliador_id as string | null) ?? null;
  }
  const pedido: PedidoParaDesignar = {
    id: p.id,
    propertyId: p.property_id,
    ownerId: p.owner_id,
    cidade: p.cidade,
    tipo: p.tipo,
    teste: p.teste,
    primeiroAvaliadorId: primeiro,
    jaDesignados: ((ja ?? []) as { avaliador_id: string }[]).map((d) => d.avaliador_id),
  };
  const r = proximoAvaliador(fila, pedido, historico, agora);
  const quando = agora.toISOString();
  if (!r.avaliador) {
    await admin.from("vistoria_pedidos").update({ status: "pedido", avaliador_id: null, designado_em: null, aguardando_avaliador: true, atualizado_em: quando }).eq("id", p.id);
    await naFilaDoAdmin(admin, "sem_avaliador", { pedidoId: p.id }, `Nenhum avaliador elegível em ${p.cidade}.`);
    await avisarAdmins(admin, "vistoria_sem_avaliador");
    return null;
  }
  const a = r.avaliador;
  const { error } = await admin.from("vistoria_designacoes").insert({ pedido_id: p.id, avaliador_id: a.id, designado_em: quando });
  if (error) return null;
  await admin.from("vistoria_pedidos").update({ status: "designado", avaliador_id: a.id, designado_em: quando, aguardando_avaliador: false, atualizado_em: quando }).eq("id", p.id);
  await admin.from("avaliadores_credenciamento").update({ ultima_designacao_em: quando }).eq("id", a.id);
  await admin.from("vistoria_fila_admin").update({ resolvido_em: quando }).eq("tipo", "sem_avaliador").eq("pedido_id", p.id).is("resolvido_em", null);
  await avisar(admin, a.userId, "vistoria_designada", ROTA_AVALIADOR);
  return a.id;
}

/** Recusa, silêncio de 24 h ou ausência do avaliador: fecha a designação e passa ao próximo da fila. */
export async function passarAoProximo(admin: Admin, pedidoId: string, avaliadorId: string, resposta: "recusada" | "expirada" | "ausencia", agora = new Date()): Promise<string | null> {
  const quando = agora.toISOString();
  await admin.from("vistoria_designacoes").update({ resposta, respondido_em: quando }).eq("pedido_id", pedidoId).eq("avaliador_id", avaliadorId).is("resposta", null);
  // Ausência do avaliador conta para a suspensão automática (2 em 90 dias; o admin revê).
  if (resposta === "ausencia") {
    await admin.from("vistoria_designacoes").update({ resposta: "ausencia", respondido_em: quando }).eq("pedido_id", pedidoId).eq("avaliador_id", avaliadorId);
    const { data: aus } = await admin.from("vistoria_designacoes").select("respondido_em").eq("avaliador_id", avaliadorId).eq("resposta", "ausencia");
    const datas = ((aus ?? []) as { respondido_em: string | null }[]).map((x) => x.respondido_em).filter((x): x is string => !!x);
    if (suspendePorAusencias(datas, agora)) {
      await admin.from("avaliadores_credenciamento").update({ status: "suspenso", motivo: "Suspensão automática: 2 ausências em 90 dias.", decidido_em: quando }).eq("id", avaliadorId).eq("status", "ativo");
      await naFilaDoAdmin(admin, "suspensao_automatica", { avaliadorId }, "2 ausências em 90 dias: rever a suspensão.");
    }
  }
  await admin.from("vistoria_pedidos").update({ status: "pedido", avaliador_id: null, designado_em: null, agendado_para: null, atualizado_em: quando }).eq("id", pedidoId);
  return designar(admin, pedidoId, agora);
}

/** Cron: designações sem resposta em 24 h passam ao próximo; lembrete D-1 da visita; sorteio da auditoria. */
export async function rotinaVistoria(admin: Admin, agora = new Date()): Promise<{ expiradas: number; lembretes: number; sorteadas: number; reprocessados: number }> {
  let expiradas = 0;
  let lembretes = 0;
  let sorteadas = 0;
  let reprocessados = 0;
  const { data: abertas } = await admin.from("vistoria_designacoes").select("pedido_id, avaliador_id, designado_em").is("resposta", null);
  for (const d of (abertas ?? []) as { pedido_id: string; avaliador_id: string; designado_em: string }[]) {
    if (!designacaoVencida(d.designado_em, agora)) continue;
    const { data: p } = await admin.from("vistoria_pedidos").select("status, avaliador_id").eq("id", d.pedido_id).maybeSingle();
    if (p?.status !== "designado" || p.avaliador_id !== d.avaliador_id) continue;
    await passarAoProximo(admin, d.pedido_id, d.avaliador_id, "expirada", agora);
    expiradas++;
  }
  // Pedidos parados sem avaliador: tenta de novo (alguém pode ter sido credenciado).
  const { data: parados } = await admin.from("vistoria_pedidos").select("id").eq("status", "pedido").eq("aguardando_avaliador", true);
  for (const p of (parados ?? []) as { id: string }[]) {
    if (await designar(admin, p.id, agora)) reprocessados++;
  }
  const hoje = hojeEmBrasilia(agora);
  const { data: agendados } = await admin
    .from("vistoria_pedidos")
    .select("id, property_id, owner_id, morador_id, agendado_para, lembrete_d1_em, avaliadores_credenciamento(parceiros(user_id))")
    .eq("status", "agendado")
    .is("lembrete_d1_em", null);
  for (const v of (agendados ?? []) as unknown as { id: string; property_id: string; owner_id: string; morador_id: string | null; agendado_para: string | null; avaliadores_credenciamento: { parceiros: { user_id: string } | null } | null }[]) {
    if (!v.agendado_para || !visitaAmanha(v.agendado_para, hoje)) continue;
    const { data: marcou } = await admin.from("vistoria_pedidos").update({ lembrete_d1_em: agora.toISOString() }).eq("id", v.id).is("lembrete_d1_em", null).select("id");
    if (!marcou?.length) continue;
    await avisar(admin, v.owner_id, "vistoria_lembrete", rotaDono(v.property_id));
    await avisar(admin, v.avaliadores_credenciamento?.parceiros?.user_id, "vistoria_lembrete", ROTA_AVALIADOR);
    await avisar(admin, v.morador_id, "vistoria_lembrete", rotaMorador(v.id));
    lembretes++;
  }
  const { data: emitidos } = await admin.from("vistoria_pedidos").select("id, avaliador_id, teste").eq("status", "laudo_emitido").not("avaliador_id", "is", null);
  for (const e of (emitidos ?? []) as { id: string; avaliador_id: string; teste: boolean }[]) {
    if (e.teste || !sorteadoParaAuditoria(e.id)) continue;
    const { error } = await admin.from("vistoria_auditoria").insert({ pedido_id: e.id, avaliador_id: e.avaliador_id });
    if (!error) sorteadas++;
  }
  return { expiradas, lembretes, sorteadas, reprocessados };
}

/**
 * E30: credenciamentos com a avaliação de teste FEITA (pedido de teste designado a eles, laudo emitido). É o registro
 * que libera a ativação e o passo 5 do checklist.
 */
export async function comTesteConcluido(admin: Admin, avaliadorIds: string[]): Promise<Set<string>> {
  if (!avaliadorIds.length) return new Set();
  const { data, error } = await admin
    .from("vistoria_pedidos")
    .select("avaliador_id")
    .eq("teste", true)
    .eq("status", STATUS_TESTE_CONCLUIDO)
    .in("avaliador_id", avaliadorIds);
  if (error) {
    console.error("[vistoria] teste concluído:", error.message);
    return new Set();
  }
  return new Set(((data ?? []) as { avaliador_id: string }[]).map((r) => r.avaliador_id));
}
