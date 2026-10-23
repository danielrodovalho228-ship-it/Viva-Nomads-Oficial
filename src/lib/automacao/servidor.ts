import type { SupabaseClient } from "@supabase/supabase-js";
import { notify, type NotificationEvent } from "@/lib/notifications";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { hojeEmBrasilia } from "@/lib/checkin";
import { MENSAGENS_AUTOMATICAS } from "@/lib/parceiros/pedido";
import { agendaDoParceiro, avisar, evento, mensagem, novoCodigo, rota } from "@/lib/parceiros/pedido-servidor";
import {
  DIAS_ANTES_LIMPEZA,
  DIAS_ANTES_SUGESTAO,
  horariosNaJanela,
  pedidosDoEvento,
  quandoBrasilia,
  semResposta,
  STATUS_NAO_ACEITOS,
  type Acao,
  type ContratoDoEvento,
  type Evento,
  type ItemReparo,
  type Janela,
  type Vinculo,
} from "./pedidos-do-evento";

/*
  "Viva rodando automático" (Prompt 38) — o lado do servidor: lê o contrato e os vínculos, pede à regra pura o que o
  evento gera e grava. Roda sem sessão (cron e eventos da estadia), com o cliente de serviço. Nunca lança: quem chama
  segue o fluxo dele. Cada pedido é um pedido normal do 31b; nenhum dinheiro passa pela Viva.
*/

type Admin = SupabaseClient;

export interface ContextoAutomacao extends ContratoDoEvento {
  ownerId: string;
  tenantId: string;
  status: string;
  inicio: string | null;
}

type Bloco = { inicio: string; fim: string; status: string | null };
const validos = (bs: Bloco[] | null | undefined) => (bs ?? []).filter((b) => b.status !== "nao_aceito");

/** Contrato com a saída (maior fim dos blocos válidos), os horários do anúncio e a próxima entrada no mesmo imóvel. */
export async function contratoDoEvento(admin: Admin, contratoId: string): Promise<ContextoAutomacao | null> {
  const { data } = await admin
    .from("contratos")
    .select("id, property_id, tenant_id, status, properties(owner_id, checkout_before, checkin_after), contrato_blocos(inicio, fim, status)")
    .eq("id", contratoId)
    .maybeSingle();
  const c = data as unknown as {
    id: string;
    property_id: string;
    tenant_id: string;
    status: string;
    properties: { owner_id: string; checkout_before: string | null; checkin_after: string | null } | null;
    contrato_blocos: Bloco[] | null;
  } | null;
  if (!c?.properties) return null;
  const blocos = validos(c.contrato_blocos);
  const saida = blocos.map((b) => b.fim).sort().at(-1);
  if (!saida) return null;
  const { data: outros } = await admin
    .from("contratos")
    .select("id, contrato_blocos(inicio, fim, status)")
    .eq("property_id", c.property_id)
    .eq("status", "ativo")
    .neq("id", c.id)
    .limit(20);
  const entradas = ((outros ?? []) as unknown as { contrato_blocos: Bloco[] | null }[])
    .map((o) => validos(o.contrato_blocos).map((b) => b.inicio).sort()[0])
    .filter((d): d is string => !!d && d >= saida)
    .sort();
  return {
    id: c.id,
    propertyId: c.property_id,
    saida,
    checkoutBefore: c.properties.checkout_before,
    proximaEntrada: entradas[0] ? { data: entradas[0], checkinAfter: c.properties.checkin_after } : null,
    ownerId: c.properties.owner_id,
    tenantId: c.tenant_id,
    status: c.status,
    inicio: blocos.map((b) => b.inicio).sort()[0] ?? null,
  };
}

export async function vinculosDoImovelAdmin(admin: Admin, propertyId: string): Promise<Vinculo[]> {
  const { data } = await admin
    .from("imovel_parceiros")
    .select("id, categoria, parceiro_id, servico_id, modo, status, instrucoes")
    .eq("property_id", propertyId)
    .in("status", ["pendente", "ativo"]);
  return ((data ?? []) as { id: string; categoria: Vinculo["categoria"]; parceiro_id: string; servico_id: string | null; modo: Vinculo["modo"]; status: Vinculo["status"]; instrucoes: string | null }[]).map(
    (v) => ({ id: v.id, categoria: v.categoria, parceiroId: v.parceiro_id, servicoId: v.servico_id, modo: v.modo, status: v.status, instrucoes: v.instrucoes }),
  );
}

/** Aviso com o horário de silêncio (22h–7h de Brasília): nesse intervalo só o e-mail, sem push. */
async function aviso(admin: Admin, destino: string, ev: NotificationEvent, url: string, agora: Date) {
  try {
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", destino).maybeSingle();
    const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    await notify({ event: ev, email: d?.notif_email === false ? undefined : (d?.email ?? undefined), name: d?.full_name ?? undefined, userId: destino, pushUrl: url });
  } catch {
    /* aviso é complemento */
  }
}

/** Um aviso por chave (automacoes_envios): o cron pode rodar de novo sem repetir. */
async function avisoUmaVez(admin: Admin, chave: string, tipo: string, destino: string, ev: NotificationEvent, url: string, agora: Date): Promise<boolean> {
  const { error } = await admin.from("automacoes_envios").insert({ chave, tipo, usuario_id: destino });
  if (error) return false;
  await aviso(admin, destino, ev, url, agora);
  return true;
}

type PedidoAuto = { id: string; cliente_id: string; parceiro_id: string; status: string; aguardando_dono: boolean; descricao: string | null; parceiros: { user_id: string } | null };

/** O pedido vai ao parceiro: as mensagens do 31b e o aviso de pedido novo (sem push no silêncio). */
export async function enviarAoParceiro(admin: Admin, p: PedidoAuto, agora: Date): Promise<void> {
  if (!p.parceiros) return;
  await mensagem(admin, p, p.cliente_id, MENSAGENS_AUTOMATICAS.boas_vindas);
  if (p.descricao) await mensagem(admin, p, p.cliente_id, p.descricao);
  await avisar(admin, p.parceiros.user_id, "parceiro_pedido_novo", p.id);
}

async function textoComServico(admin: Admin, servicoId: string | null, descricao: string): Promise<string> {
  if (!servicoId) return descricao;
  const { data } = await admin.from("parceiro_servicos").select("titulo, preco_base, unidade").eq("id", servicoId).maybeSingle();
  const s = data as { titulo: string; preco_base: number | string | null; unidade: string | null } | null;
  if (!s) return descricao;
  const preco = s.preco_base == null ? "" : ` (a partir de ${Number(s.preco_base).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${s.unidade ? ` ${s.unidade}` : ""})`;
  return `${descricao}\nServiço: ${s.titulo}${preco}.`;
}

async function horariosDoPedido(admin: Admin, parceiroId: string, janela: Janela | null, agora: Date): Promise<{ horarios: string[]; aviso: string }> {
  if (!janela) return { horarios: [], aviso: "" };
  const r = horariosNaJanela(janela, await agendaDoParceiro(admin, parceiroId), agora);
  return { horarios: r.horarios, aviso: r.foraDaAgenda ? "\nFora da sua agenda: proponha outro horário." : "" };
}

export interface CriarAutomatico {
  ctx: Pick<ContextoAutomacao, "id" | "propertyId" | "ownerId">;
  acao: Extract<Acao, { tipo: "criar" }>;
  agora: Date;
}

/** Cria o pedido automático. A 2ª tentativa com a mesma chave não cria outro (devolve null). */
export async function criarPedidoAutomatico(admin: Admin, { ctx, acao, agora }: CriarAutomatico): Promise<{ id: string } | null> {
  const { data: parc } = await admin.from("parceiros").select("id, user_id, status").eq("id", acao.parceiroId).maybeSingle();
  const parceiro = parc as { id: string; user_id: string; status: string } | null;
  if (!parceiro || parceiro.status !== "publicado") return null;
  const { horarios, aviso: foraDaAgenda } = await horariosDoPedido(admin, parceiro.id, acao.janela, agora);
  const descricao = (await textoComServico(admin, acao.servicoId, acao.descricao)) + foraDaAgenda;
  let criado: { id: string } | null = null;
  for (let tentativa = 0; tentativa < 3 && !criado; tentativa++) {
    const { data, error } = await admin
      .from("parceiro_pedidos")
      .insert({
        codigo: novoCodigo(),
        parceiro_id: parceiro.id,
        cliente_id: ctx.ownerId,
        servico_id: acao.servicoId,
        property_id: ctx.propertyId,
        categoria: acao.categoria,
        descricao: descricao.slice(0, 2000),
        horarios_propostos: horarios,
        origem: "automatico",
        chave_automacao: acao.chave,
        gatilho: acao.gatilho,
        vinculo_id: acao.vinculoId || null,
        contrato_id: ctx.id,
        janela_inicio: acao.janela?.inicio ?? null,
        janela_fim: acao.janela?.fim ?? null,
        aguardando_dono: acao.aguardandoDono,
        enviado_em: acao.aguardandoDono ? null : agora.toISOString(),
      })
      .select("id")
      .single();
    if (!error && data) criado = data as { id: string };
    else if (error?.code === "23505" && /chave_automacao/.test(error.message ?? "")) return null; // já existe: idempotente
    else if (error?.code !== "23505") {
      console.error("[automação] pedido:", error?.code, error?.message);
      return null;
    }
  }
  if (!criado) return null;
  await evento(admin, criado.id, null, "solicitado", { automatico: true, gatilho: acao.gatilho, aguardando_dono: acao.aguardandoDono });
  if (acao.aguardandoDono) await aviso(admin, ctx.ownerId, "pedido_auto_confirmar", rota(criado.id), agora);
  else await enviarAoParceiro(admin, { id: criado.id, cliente_id: ctx.ownerId, parceiro_id: parceiro.id, status: "solicitado", aguardando_dono: false, descricao, parceiros: { user_id: parceiro.user_id } }, agora);
  return criado;
}

const COLS_AUTO = "id, cliente_id, parceiro_id, status, aguardando_dono, descricao, servico_id, chave_automacao, gatilho, parceiros(user_id)";

/** Remarcação: o pedido da mesma chave ganha a janela e o texto novos. Já aceito: só a mensagem com as datas novas. */
async function atualizarPedido(admin: Admin, acao: Extract<Acao, { tipo: "atualizar" }>, agora: Date): Promise<boolean> {
  const { data } = await admin.from("parceiro_pedidos").select(COLS_AUTO).eq("chave_automacao", acao.chave).maybeSingle();
  const p = data as unknown as (PedidoAuto & { servico_id: string | null }) | null;
  if (!p || ["cancelado", "recusado", "concluido"].includes(p.status)) return false;
  const nova = `A estadia foi remarcada. Nova janela: entre ${quandoBrasilia(acao.janela.inicio)} e ${quandoBrasilia(acao.janela.fim)}.`;
  if ((STATUS_NAO_ACEITOS as readonly string[]).includes(p.status)) {
    const { horarios, aviso: fora } = await horariosDoPedido(admin, p.parceiro_id, acao.janela, agora);
    const descricao = (await textoComServico(admin, p.servico_id, acao.descricao)) + fora;
    const { data: ok } = await admin
      .from("parceiro_pedidos")
      .update({ descricao, horarios_propostos: horarios, janela_inicio: acao.janela.inicio, janela_fim: acao.janela.fim, atualizado_em: agora.toISOString() })
      .eq("id", p.id)
      .eq("status", p.status)
      .select("id");
    if (!ok?.length) return false;
  }
  await evento(admin, p.id, null, "remarcado", { janela_inicio: acao.janela.inicio, janela_fim: acao.janela.fim });
  if (!p.aguardando_dono && p.parceiros) {
    await mensagem(admin, p, p.cliente_id, nova);
    await avisar(admin, p.parceiros.user_id, "pedido_auto_atualizado", p.id);
  }
  return true;
}

/**
 * Encerramento: cancela a limpeza e a lavanderia automáticas ainda não aceitas (solicitado/orçado). O reparo apontado
 * na conferência de saída continua: é do imóvel, não da estadia.
 */
async function cancelarAutomaticos(admin: Admin, contratoId: string, agora: Date): Promise<number> {
  const { data } = await admin
    .from("parceiro_pedidos")
    .select(COLS_AUTO)
    .eq("contrato_id", contratoId)
    .eq("origem", "automatico")
    .in("gatilho", ["saida_limpeza", "saida_lavanderia"])
    .in("status", STATUS_NAO_ACEITOS as unknown as string[]);
  let n = 0;
  for (const p of (data ?? []) as unknown as PedidoAuto[]) {
    const { data: ok } = await admin.from("parceiro_pedidos").update({ status: "cancelado", atualizado_em: agora.toISOString() }).eq("id", p.id).eq("status", p.status).select("id");
    if (!ok?.length) continue;
    n += 1;
    await evento(admin, p.id, null, "cancelar", { motivo: "contrato_encerrado" });
    if (!p.aguardando_dono && p.parceiros) {
      await mensagem(admin, p, p.cliente_id, "O contrato do imóvel foi encerrado e este pedido foi cancelado.");
      await avisar(admin, p.parceiros.user_id, "pedido_auto_cancelado", p.id);
    }
  }
  return n;
}

export interface Resultado {
  criados: number;
  atualizados: number;
  cancelados: number;
  avisos: number;
}

/** Grava o que a regra pura decidiu. */
export async function executarAcoes(admin: Admin, ctx: ContextoAutomacao, acoes: Acao[], agora: Date): Promise<Resultado> {
  const r: Resultado = { criados: 0, atualizados: 0, cancelados: 0, avisos: 0 };
  for (const a of acoes) {
    try {
      switch (a.tipo) {
        case "criar":
          if (await criarPedidoAutomatico(admin, { ctx, acao: a, agora })) r.criados += 1;
          break;
        case "atualizar":
          if (await atualizarPedido(admin, a, agora)) r.atualizados += 1;
          break;
        case "cancelar_automaticos":
          r.cancelados += await cancelarAutomaticos(admin, a.contratoId, agora);
          break;
        case "avisar_dono_sem_vinculo":
          if (await avisoUmaVez(admin, `saida_sem_parceiro:${ctx.id}:${ctx.ownerId}`, "saida_sem_parceiro", ctx.ownerId, "saida_sem_parceiro", "/parceiros/buscar?categoria=limpeza", agora)) r.avisos += 1;
          break;
        case "sugerir_morador":
          if (await avisoUmaVez(admin, `sugestao_parceiros_morador:${ctx.id}:${ctx.tenantId}:${a.momento}`, "sugestao_parceiros_morador", ctx.tenantId, "sugestao_parceiros_morador", `${HREF_ESTADIA(ctx.id)}#ajuda-mudanca`, agora))
            r.avisos += 1;
          break;
      }
    } catch (e) {
      console.error("[automação]", a.tipo, e instanceof Error ? e.message : e);
    }
  }
  return r;
}

/** Evento da estadia → pedidos. Nunca lança. */
export async function aoEventoDaEstadia(admin: Admin, contratoId: string, ev: Evento, agora = new Date()): Promise<Resultado | null> {
  try {
    const ctx = await contratoDoEvento(admin, contratoId);
    if (!ctx) return null;
    const vinculos = await vinculosDoImovelAdmin(admin, ctx.propertyId);
    return await executarAcoes(admin, ctx, pedidosDoEvento(ev, vinculos, ctx), agora);
  } catch (e) {
    console.error("[automação] evento:", ev.tipo, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Conferência de SAÍDA fechada: os itens do dono marcados "precisa de reparo" viram o pedido de manutenção. */
export async function aoFecharConferencia(admin: Admin, conferenciaId: string): Promise<void> {
  try {
    const { data: c } = await admin.from("conferencias").select("id, tipo, contrato_id").eq("id", conferenciaId).maybeSingle();
    if (!c || c.tipo !== "saida") return;
    const { data } = await admin
      .from("conferencia_itens")
      .select("comodo, descricao, foto_path")
      .eq("conferencia_id", conferenciaId)
      .eq("parte", "proprietario")
      .eq("precisa_reparo", true)
      .order("criado_em");
    const linhas = (data ?? []) as { comodo: string; descricao: string; foto_path: string | null }[];
    if (!linhas.length) return;
    // Agrupa por cômodo e descrição (cada foto é uma linha na conferência).
    const itens = new Map<string, ItemReparo>();
    for (const l of linhas) {
      const k = `${l.comodo}\u0000${l.descricao}`;
      const it = itens.get(k) ?? { comodo: l.comodo, descricao: l.descricao, fotos: [] };
      if (l.foto_path) it.fotos.push(l.foto_path);
      itens.set(k, it);
    }
    await aoEventoDaEstadia(admin, c.contrato_id as string, { tipo: "conferencia_saida_fechada", itensReparo: [...itens.values()] });
  } catch (e) {
    console.error("[automação] conferência:", e instanceof Error ? e.message : e);
  }
}

/**
 * Passo diário do cron: saída em até 5 dias (limpeza/lavanderia ou o aviso ao dono), sugestões ao morador em até 7
 * dias da entrada e da saída e o aviso de 24 h sem resposta. A chave de idempotência segura a 2ª rodada. `simular`:
 * só conta.
 */
export async function automacaoDaEstadia(admin: Admin, agora: Date, simular: boolean): Promise<{ automaticos: number; sugestoesMorador: number; semResposta: number }> {
  const hoje = hojeEmBrasilia(agora);
  const dia = (n: number) => new Date(Date.parse(hoje) + n * 86_400_000).toISOString().slice(0, 10);
  const out = { automaticos: 0, sugestoesMorador: 0, semResposta: 0 };
  const { data } = await admin
    .from("contratos")
    .select("id, assinado_proprietario_em, assinado_inquilino_em, contrato_blocos(inicio, fim, status)")
    .eq("status", "ativo")
    .limit(2000);
  for (const c of (data ?? []) as unknown as { id: string; assinado_proprietario_em: string | null; assinado_inquilino_em: string | null; contrato_blocos: Bloco[] | null }[]) {
    if (!c.assinado_proprietario_em || !c.assinado_inquilino_em) continue;
    const blocos = validos(c.contrato_blocos);
    const inicio = blocos.map((b) => b.inicio).sort()[0];
    const saida = blocos.map((b) => b.fim).sort().at(-1);
    const eventos: Evento[] = [];
    if (saida && saida > hoje && saida <= dia(DIAS_ANTES_LIMPEZA)) eventos.push({ tipo: "saida_em_5_dias" });
    if (inicio && inicio > hoje && inicio <= dia(DIAS_ANTES_SUGESTAO)) eventos.push({ tipo: "entrada_em_7_dias" });
    if (saida && saida > hoje && saida <= dia(DIAS_ANTES_SUGESTAO)) eventos.push({ tipo: "saida_em_7_dias" });
    for (const ev of eventos) {
      if (simular) {
        if (ev.tipo === "saida_em_5_dias") out.automaticos += 1;
        else out.sugestoesMorador += 1;
        continue;
      }
      const r = await aoEventoDaEstadia(admin, c.id, ev, agora);
      if (!r) continue;
      if (ev.tipo === "saida_em_5_dias") out.automaticos += r.criados;
      else out.sugestoesMorador += r.avisos;
    }
  }
  // 24 h sem resposta do parceiro: o dono é avisado uma vez e pode trocar com 1 toque.
  const { data: parados } = await admin
    .from("parceiro_pedidos")
    .select("id, cliente_id, status, enviado_em")
    .eq("origem", "automatico")
    .eq("status", "solicitado")
    .eq("aguardando_dono", false)
    .is("sem_resposta_avisado_em", null)
    .lte("enviado_em", new Date(agora.getTime() - 24 * 3_600_000).toISOString())
    .limit(500);
  for (const p of (parados ?? []) as { id: string; cliente_id: string; status: string; enviado_em: string }[]) {
    if (!semResposta(p.enviado_em, p.status, agora)) continue;
    if (simular) {
      out.semResposta += 1;
      continue;
    }
    const { data: marcou } = await admin.from("parceiro_pedidos").update({ sem_resposta_avisado_em: agora.toISOString() }).eq("id", p.id).is("sem_resposta_avisado_em", null).select("id");
    if (!marcou?.length) continue;
    await evento(admin, p.id, null, "sem_resposta", {});
    await aviso(admin, p.cliente_id, "pedido_auto_sem_resposta", rota(p.id), agora);
    out.semResposta += 1;
  }
  return out;
}
