import type { SupabaseClient } from "@supabase/supabase-js";
import { notify, type NotificationEvent } from "@/lib/notifications";
import { blocoDados } from "@/lib/notifications/modelo-email";
import { escaparHtml } from "@/lib/escapar-html";
import { EVENTOS_VISTORIA_COM_FATOS, corpoVistoria, type EventoVistoria, type FatosVistoria } from "./corpo-email";
import { hojeEmBrasilia } from "@/lib/checkin";
import { STATUS_TESTE_CONCLUIDO } from "./entrada";
import { criteriosAtingidos, sugerirAvaliadores, CRITERIOS_PUBLICOS, type Sugestoes } from "./escolha";
import {
  designacaoVencida,
  notaConduta,
  sorteadoParaAuditoria,
  visitaAmanha,
  type AvaliadorFila,
  type HistoricoDesignacao,
  type PedidoParaDesignar,
  type StatusCredenciamento,
  type TipoPedido,
} from "./regras";

/*
  Prompt 62-B1 / E648 — o lado do servidor da avaliação do imóvel: lê a fila da cidade e o histórico, pede à regra pura os
  avaliadores SUGERIDOS e grava a escolha do DONO. A Viva não designa ninguém (E648, anti-subordinação) e não suspende
  ninguém sozinha: critérios públicos de qualidade só abrem uma revisão humana. Roda com o cliente de serviço (ações
  depois do portão de cada parte, e o cron). Nunca lança: aviso é complemento.
*/

type Admin = SupabaseClient;

export const ROTA_AVALIADOR = "/dashboard/parceiro/avaliacao";
export const rotaDono = (propertyId: string) => `/dashboard/imoveis/${propertyId}/nivel#avaliacao`;
export const rotaMorador = (pedidoId: string) => `/dashboard/avaliacao-imovel/${pedidoId}`;
export const ROTA_ADMIN = "/admin/avaliadores";

/** De onde vêm os fatos do e-mail (E289): o pedido de avaliação (imóvel, data da visita, avaliador) ou só o imóvel. */
export type RefVistoria = { pedidoId?: string | null; propertyId?: string | null };

/** E289: lê no banco o que o e-mail precisa nomear — imóvel (título, bairro, cidade), visita e avaliador. */
export async function fatosDaVistoria(admin: Admin, ref: RefVistoria): Promise<FatosVistoria> {
  let propertyId = ref.propertyId ?? null;
  let visita: string | null = null;
  let avaliador: string | null = null;
  if (ref.pedidoId) {
    const { data: p } = await admin
      .from("vistoria_pedidos")
      .select("property_id, agendado_para, avaliadores_credenciamento(parceiros(nome_publico))")
      .eq("id", ref.pedidoId)
      .maybeSingle();
    const pp = p as { property_id?: string | null; agendado_para?: string | null; avaliadores_credenciamento?: { parceiros?: { nome_publico?: string | null } | null } | null } | null;
    propertyId = propertyId ?? pp?.property_id ?? null;
    visita = pp?.agendado_para ?? null;
    avaliador = pp?.avaliadores_credenciamento?.parceiros?.nome_publico ?? null;
  }
  if (!propertyId) return { imovel: null, visita, avaliador };
  const { data: im } = await admin.from("properties").select("title, address, city").eq("id", propertyId).maybeSingle();
  const i = im as { title?: string | null; address?: string | null; city?: string | null } | null;
  return { imovel: i ? { id: propertyId, titulo: i.title, bairro: i.address, cidade: i.city } : null, visita, avaliador };
}

/**
 * Avisa uma pessoa de um evento da avaliação. E289: com `ref`, o e-mail sai com os fatos do caso (imóvel nomeado, data
 * e hora da visita, avaliador) no assunto, no corpo e no bloco de dados.
 */
export async function avisar(admin: Admin, destino: string | null | undefined, ev: NotificationEvent, url: string, ref?: RefVistoria): Promise<void> {
  if (!destino) return;
  try {
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", destino).maybeSingle();
    const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    const corpo = ref && EVENTOS_VISTORIA_COM_FATOS.has(ev) ? corpoVistoria(ev as EventoVistoria, await fatosDaVistoria(admin, ref)) : null;
    await notify({
      event: ev,
      email: d?.notif_email === false ? undefined : (d?.email ?? undefined),
      name: d?.full_name ?? undefined,
      userId: destino,
      pushUrl: url,
      imovelId: ref?.propertyId,
      ...(corpo
        ? {
            ...(corpo.subject ? { subject: corpo.subject } : {}),
            body: corpo.body,
            ...(corpo.linhas.length ? { detailsHtml: blocoDados(corpo.linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))) } : {}),
          }
        : {}),
    });
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
export async function naFilaDoAdmin(admin: Admin, tipo: "sem_avaliador" | "avaliacao_teste" | "suspensao_automatica" | "proposta_descredenciamento" | "revisao_criterio", ref: { pedidoId?: string; avaliadorId?: string }, motivo: string): Promise<void> {
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

/**
 * A fila da cidade (todos os credenciamentos; a regra pura decide quem pode). Achado 39: uma leitura que falha LANÇA —
 * fila vazia por erro viraria "Nenhum avaliador elegível" (na designação) ou uma fila de rodízio vazia (no admin).
 */
export async function filaDaCidade(admin: Admin): Promise<AvaliadorFila[]> {
  const { data, error } = await admin
    .from("avaliadores_credenciamento")
    .select("id, cidade, status, criado_em, ativado_em, ultima_designacao_em, relacoes_donos, relacoes_imoveis, parceiros(user_id)")
    .in("status", ["em_teste", "ativo", "suspenso"]);
  if (error) throw new Error(`[vistoria] fila da cidade: ${error.message}`);
  const linhas = (data ?? []) as unknown as LinhaCred[];
  const ids = linhas.map((l) => l.parceiros?.user_id).filter((x): x is string => !!x);
  const { data: perfis, error: erroPerfis } = ids.length ? await admin.from("profiles").select("id, is_teste").in("id", ids) : { data: [], error: null };
  if (erroPerfis) throw new Error(`[vistoria] contas de teste da fila: ${erroPerfis.message}`);
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
  // Achado 39: histórico incompleto por erro apagaria um impedimento (quem já prestou serviço ao dono seria designado).
  const falha = [pedidos, vinculos, avaliacoes].find((r) => r.error);
  if (falha) throw new Error(`[vistoria] histórico do pedido: ${falha.error!.message}`);
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

type LeituraEscolha = { p: LinhaPedido; sugestoes: Sugestoes };

/** Lê o pedido, a fila e o histórico e devolve os sugeridos. Qualquer leitura que falha LANÇA (nunca vira "ninguém elegível"). */
async function leituraDaEscolha(admin: Admin, pedidoId: string, agora: Date): Promise<LeituraEscolha | null> {
  const { data } = await admin.from("vistoria_pedidos").select("id, property_id, owner_id, cidade, tipo, teste, status, origem_pedido_id").eq("id", pedidoId).maybeSingle();
  const p = data as LinhaPedido | null;
  if (!p || p.status !== "pedido") return null;
  const [jaLeitura, fila, historico] = await Promise.all([
    admin.from("vistoria_designacoes").select("avaliador_id").eq("pedido_id", p.id),
    filaDaCidade(admin),
    historicoDoPedido(admin, p.owner_id, p.property_id),
  ]);
  if (jaLeitura.error) throw new Error(`[vistoria] designações do pedido: ${jaLeitura.error.message}`);
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
    jaDesignados: ((jaLeitura.data ?? []) as { avaliador_id: string }[]).map((d) => d.avaliador_id),
  };
  return { p, sugestoes: sugerirAvaliadores(fila, pedido, historico, agora) };
}

/**
 * E648: abre a ESCOLHA do dono. Não designa ninguém: calcula quem pode ser escolhido. Sem nenhum sugerido, o pedido fica
 * "aguardando avaliador" e o admin é avisado (para credenciar mais gente). Devolve quantos o dono pode escolher (null se a
 * leitura falhou: o pedido fica aguardando e a rotina do cron tenta de novo, sem avisar o admin à toa).
 */
export async function abrirEscolha(admin: Admin, pedidoId: string, agora = new Date()): Promise<number | null> {
  let l: LeituraEscolha | null;
  try {
    l = await leituraDaEscolha(admin, pedidoId, agora);
  } catch (e) {
    console.error("[vistoria] abrirEscolha: leitura falhou; o pedido fica para a próxima rotina:", e instanceof Error ? e.message : e);
    await admin.from("vistoria_pedidos").update({ aguardando_avaliador: true, atualizado_em: agora.toISOString() }).eq("id", pedidoId).eq("status", "pedido");
    return null;
  }
  if (!l) return null;
  const quando = agora.toISOString();
  if (!l.sugestoes.sugeridos.length) {
    await admin.from("vistoria_pedidos").update({ aguardando_avaliador: true, atualizado_em: quando }).eq("id", l.p.id);
    await naFilaDoAdmin(admin, "sem_avaliador", { pedidoId: l.p.id }, `Nenhum avaliador disponível para o dono escolher em ${l.p.cidade}.`);
    await avisarAdmins(admin, "vistoria_sem_avaliador");
    return 0;
  }
  await admin.from("vistoria_pedidos").update({ aguardando_avaliador: false, atualizado_em: quando }).eq("id", l.p.id);
  await admin.from("vistoria_fila_admin").update({ resolvido_em: quando }).eq("tipo", "sem_avaliador").eq("pedido_id", l.p.id).is("resolvido_em", null);
  return l.sugestoes.sugeridos.length;
}

/** Os sugeridos do pedido (o que o dono vê para escolher). Lança se uma leitura falha. */
export async function sugeridosDoPedido(admin: Admin, pedidoId: string, agora = new Date()): Promise<AvaliadorFila[] | null> {
  const l = await leituraDaEscolha(admin, pedidoId, agora);
  return l ? l.sugestoes.sugeridos : null;
}

/**
 * E648: o DONO escolheu o avaliador. Só vale quem está entre os sugeridos (os impedimentos de independência seguem
 * valendo). O avaliador é avisado e responde com o próprio preço e prazo (ou recusa); nada é imposto a ele.
 */
export async function escolherNoServidor(admin: Admin, pedidoId: string, avaliadorId: string, agora = new Date()): Promise<{ ok: true } | { ok: false; erro: string }> {
  let l: LeituraEscolha | null;
  try {
    l = await leituraDaEscolha(admin, pedidoId, agora);
  } catch {
    return { ok: false, erro: "Não foi possível conferir os avaliadores agora. Tente de novo." };
  }
  if (!l) return { ok: false, erro: "Este pedido não está aguardando a escolha do avaliador." };
  const a = l.sugestoes.sugeridos.find((x) => x.id === avaliadorId);
  if (!a) return { ok: false, erro: "Este avaliador não pode avaliar este imóvel. Escolha outro da lista." };
  const quando = agora.toISOString();
  const { error } = await admin.from("vistoria_designacoes").insert({ pedido_id: l.p.id, avaliador_id: a.id, designado_em: quando });
  if (error) return { ok: false, erro: "Não foi possível registrar a escolha. Tente de novo." };
  const { data: mudou } = await admin
    .from("vistoria_pedidos")
    .update({ status: "designado", avaliador_id: a.id, designado_em: quando, escolhido_em: quando, aguardando_avaliador: false, atualizado_em: quando })
    .eq("id", l.p.id)
    .eq("status", "pedido")
    .select("id");
  if (!mudou?.length) return { ok: false, erro: "Este pedido não está aguardando a escolha do avaliador." };
  await admin.from("avaliadores_credenciamento").update({ ultima_designacao_em: quando }).eq("id", a.id);
  await admin.from("vistoria_fila_admin").update({ resolvido_em: quando }).eq("tipo", "sem_avaliador").eq("pedido_id", l.p.id).is("resolvido_em", null);
  await avisar(admin, a.userId, "vistoria_designada", ROTA_AVALIADOR, { pedidoId: l.p.id });
  return { ok: true };
}

/**
 * Recusa, silêncio de 24 h, ausência do avaliador ou proposta recusada pelo dono: fecha a escolha e DEVOLVE o pedido ao
 * dono para escolher outro (a Viva não passa ao "próximo da fila"). Ausência confere os critérios públicos (revisão
 * humana; nada de suspensão automática).
 */
export async function devolverAoDono(admin: Admin, pedidoId: string, avaliadorId: string, resposta: "recusada" | "expirada" | "ausencia", agora = new Date()): Promise<void> {
  const quando = agora.toISOString();
  await admin.from("vistoria_designacoes").update({ resposta, respondido_em: quando }).eq("pedido_id", pedidoId).eq("avaliador_id", avaliadorId).is("resposta", null);
  if (resposta === "ausencia") {
    await admin.from("vistoria_designacoes").update({ resposta: "ausencia", respondido_em: quando }).eq("pedido_id", pedidoId).eq("avaliador_id", avaliadorId);
  }
  await admin
    .from("vistoria_pedidos")
    .update({ status: "pedido", avaliador_id: null, designado_em: null, escolhido_em: null, valor_proposto: null, prazo_proposto_dias: null, proposta_em: null, proposta_aceita_em: null, agendado_para: null, atualizado_em: quando })
    .eq("id", pedidoId);
  await abrirEscolha(admin, pedidoId, agora);
  if (resposta === "ausencia") await revisarCriterios(admin, avaliadorId, agora);
}

/**
 * E648: confere os critérios PÚBLICOS de qualidade do avaliador. Atingir um critério só coloca um item na fila do admin
 * (revisão humana, com direito de resposta do avaliador). O status do avaliador nunca muda por aqui.
 */
export async function revisarCriterios(admin: Admin, avaliadorId: string, agora = new Date()): Promise<string[]> {
  const dia = 86_400_000;
  const desde = (d: number) => new Date(agora.getTime() - d * dia).toISOString();
  const [aus, rev, ped, cond] = await Promise.all([
    admin.from("vistoria_designacoes").select("respondido_em").eq("avaliador_id", avaliadorId).eq("resposta", "ausencia").gte("respondido_em", desde(90)),
    admin.from("vistoria_auditoria").select("resultado").eq("avaliador_id", avaliadorId).eq("resultado", "nao_confere").gte("revisado_em", desde(365)),
    admin.from("vistoria_pedidos").select("id, proposta_aceita_em, prazo_proposto_dias").eq("avaliador_id", avaliadorId).not("proposta_aceita_em", "is", null).gte("proposta_aceita_em", desde(180)),
    admin.from("vistoria_conduta").select("pontualidade, cordialidade, cuidado").eq("avaliador_id", avaliadorId).eq("autor", "dono"),
  ]);
  if ([aus, rev, ped, cond].some((r) => r.error)) return [];
  const pedidos = (ped.data ?? []) as { id: string; proposta_aceita_em: string; prazo_proposto_dias: number | null }[];
  let foraDoPrazo = 0;
  if (pedidos.length) {
    const { data: laudos } = await admin.from("vistoria_laudos").select("pedido_id, emitido_em, versao").in("pedido_id", pedidos.map((x) => x.id)).eq("versao", 1);
    const emitido = new Map(((laudos ?? []) as { pedido_id: string; emitido_em: string }[]).map((l) => [l.pedido_id, l.emitido_em]));
    for (const x of pedidos) {
      const em = emitido.get(x.id);
      if (!em || !x.prazo_proposto_dias) continue;
      if (Date.parse(em) > Date.parse(x.proposta_aceita_em) + x.prazo_proposto_dias * dia) foraDoPrazo++;
    }
  }
  const notas = ((cond.data ?? []) as { pontualidade: number; cordialidade: number; cuidado: number }[]).map((c) => ({ ...c }) as Record<string, number>);
  const atingidos = criteriosAtingidos({
    ausenciasSemAviso90d: (aus.data ?? []).length,
    naoConfere12m: (rev.data ?? []).length,
    laudosForaDoPrazo180d: foraDoPrazo,
    notaConduta: notaConduta(notas),
    avaliacoesConduta: notas.length,
  });
  if (!atingidos.length) return [];
  const { data: aberto } = await admin.from("vistoria_fila_admin").select("id").eq("tipo", "revisao_criterio").eq("avaliador_id", avaliadorId).is("resolvido_em", null).limit(1);
  if (!aberto?.length) {
    const textos = atingidos.map((id) => CRITERIOS_PUBLICOS.find((c) => c.id === id)!.texto);
    await naFilaDoAdmin(admin, "revisao_criterio", { avaliadorId }, `Critério público atingido: ${textos.join(" | ")} Rever com o avaliador (direito de resposta) antes de qualquer decisão.`);
  }
  return atingidos;
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
    await devolverAoDono(admin, d.pedido_id, d.avaliador_id, "expirada", agora);
    expiradas++;
  }
  // Pedidos sem nenhum avaliador para o dono escolher: tenta de novo (alguém pode ter sido credenciado).
  const { data: parados } = await admin.from("vistoria_pedidos").select("id").eq("status", "pedido").eq("aguardando_avaliador", true);
  for (const p of (parados ?? []) as { id: string }[]) {
    if (await abrirEscolha(admin, p.id, agora)) reprocessados++;
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
    await avisar(admin, v.owner_id, "vistoria_lembrete", rotaDono(v.property_id), { pedidoId: v.id, propertyId: v.property_id });
    await avisar(admin, v.avaliadores_credenciamento?.parceiros?.user_id, "vistoria_lembrete", ROTA_AVALIADOR, { pedidoId: v.id, propertyId: v.property_id });
    await avisar(admin, v.morador_id, "vistoria_lembrete", rotaMorador(v.id), { pedidoId: v.id, propertyId: v.property_id });
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
