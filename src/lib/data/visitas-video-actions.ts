"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExemplo, EXEMPLO_AVISO_DEMO } from "@/lib/demo-listing";
import { isMotivo, motivoLabel, motivoParaDono } from "@/lib/pedidos/pedidos";
import { erroBancoPT } from "@/lib/erros-banco";
import { revalidatePath } from "next/cache";
import { conversationId as idConversa } from "@/lib/messages/conversation-id";
import { after } from "next/server";
import { notify } from "@/lib/notifications";
import type { NotificationEvent } from "@/lib/notifications/eventos-email";
import type { DadosDaDecisao } from "@/lib/notifications/regra-push";
import { enderecoDaVisita, mostraEnderecoDaVisita, type EnderecoVisita } from "@/lib/visitas/endereco-visita";
import {
  ehModalidade,
  ehStatusVisita,
  formatarHorarioBrasilia,
  mudancaDeStatus,
  validarHorarios,
  MODALIDADE_ROTULO,
  type AcaoVisitaDono,
  type ModalidadeVisita,
  type StatusVisita,
} from "@/lib/visitas-video";

interface Resultado {
  ok: boolean;
  error?: string;
  demo?: boolean;
  needsAuth?: boolean;
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * E-mail + push da visita para UMA pessoa (prompt 23, item 6): pedida → dono; confirmada, remarcada e cancelada →
 * a outra parte. Sem nome, telefone ou e-mail do morador para o dono (contato protegido até o aceite).
 * Depois da resposta (`after`) e best-effort: o aviso nunca quebra o fluxo.
 */
/** `decisao` (44-SITE, item 2): o push de visita pedida/remarcada diz o imóvel e até quando responder. */
function avisarVisita(admin: Admin, para: string, evento: NotificationEvent, detalhe: string, endereco?: EnderecoVisita | null, decisao?: DadosDaDecisao) {
  after(async () => {
    try {
      const { data: p } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", para).maybeSingle();
      if (!p || p.notif_email === false) return;
      await notify({
        event: evento,
        email: (p.email as string | null) ?? undefined,
        name: ((p.full_name as string | null) ?? "").split(" ")[0] || undefined,
        userId: para,
        pushUrl: "/dashboard/visitas",
        ...(decisao ? { decisao } : {}),
        // Visita presencial confirmada: o endereço exato e "Abrir no mapa" vão SÓ para o morador (complemento do prompt 23).
        detailsText: endereco ? `${detalhe}\nEndereço: ${endereco.texto}\nAbrir no mapa: ${endereco.mapa}` : detalhe,
        detailsHtml:
          `<p style="margin:12px 0 0">${detalhe.replace(/[<>&]/g, "")}</p>` +
          (endereco
            ? `<p style="margin:8px 0 0"><strong>Endereço:</strong> ${endereco.texto.replace(/[<>&"]/g, "")}</p><p style="margin:8px 0 0"><a href="${endereco.mapa.replace(/"/g, "%22")}">Abrir no mapa</a></p>`
            : ""),
      });
    } catch {
      /* best-effort */
    }
  });
}

/** Morador pede a visita por vídeo (atalho do pedido com modalidade). */
export async function pedirVisitaVideo(propertyId: string, horarios: unknown, motivo?: string): Promise<Resultado> {
  return pedirVisita(propertyId, horarios, motivo, "video");
}

/**
 * Morador pede a visita — por vídeo ou PRESENCIAL (prompt 23). Autoridade no servidor: horários (já em instante
 * UTC; a tela converte a hora de Brasília), dono do imóvel e anúncio de exemplo. Avisa o dono por e-mail.
 */
export async function pedirVisita(propertyId: string, horarios: unknown, motivo?: string, modalidade: ModalidadeVisita = "video"): Promise<Resultado> {
  if (!ehModalidade(modalidade)) return { ok: false, error: "Tipo de visita inválido." };
  if (typeof propertyId !== "string" || !propertyId) return { ok: false, error: "Imóvel não encontrado." };
  // Anúncio de exemplo: modo demonstração, nada é gravado.
  if (isExemplo(propertyId)) return { ok: true, demo: true, error: EXEMPLO_AVISO_DEMO };

  const v = validarHorarios(horarios);
  if (!v.ok) return { ok: false, error: v.error };

  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, needsAuth: true, error: modalidade === "video" ? "Entre para pedir a visita por vídeo." : "Entre para agendar a visita." };

  const { data: prop } = await supabase.from("properties").select("owner_id, title").eq("id", propertyId).maybeSingle();
  const ownerId = (prop?.owner_id as string | undefined) ?? null;
  if (!ownerId) return { ok: false, error: "Imóvel não encontrado ou indisponível." };
  if (ownerId === user.id) return { ok: false, error: "Este anúncio é seu." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };
  const { error } = await admin.from("visitas_video").insert({
    property_id: propertyId,
    owner_id: ownerId,
    tenant_id: user.id,
    horarios: v.horarios,
    motivo: motivo && isMotivo(motivo) ? motivo : null,
    modalidade,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Você já tem um pedido de visita em aberto para este imóvel." };
    return { ok: false, error: erroBancoPT(error) };
  }
  // Abre (ou continua) a conversa com o proprietário: o cartão da visita aparece no topo dela, com as ações.
  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: idConversa(user.id, ownerId, propertyId),
    sender_id: user.id,
    receiver_id: ownerId,
    property_id: propertyId,
    body: `Pedido de visita ${MODALIDADE_ROTULO[modalidade].toLowerCase()}. Horários: ${v.horarios.map(formatarHorarioBrasilia).join("; ")}.`,
  });
  if (msgErr) console.error("[pedirVisita] falha ao abrir conversa:", msgErr.code, msgErr.message);
  avisarVisita(
    admin,
    ownerId,
    "visita_pedida",
    `Visita ${MODALIDADE_ROTULO[modalidade].toLowerCase()} pedida. Horários propostos: ${v.horarios.map(formatarHorarioBrasilia).join("; ")}. Confirme um, proponha outro ou recuse em Visitas.`,
    undefined,
    // Responder antes do primeiro horário proposto.
    { imovel: (prop?.title as string | null) ?? null, prazo: [...v.horarios].sort()[0] ?? null, destinatarioEhParte: true },
  );
  revalidatePath("/dashboard/visitas");
  revalidatePath("/dashboard/agenda");
  return { ok: true };
}

export interface VisitaDono {
  id: string;
  imovel: string;
  propertyId: string;
  modalidade: ModalidadeVisita;
  horarios: string[];
  /** Rótulo do motivo da estadia (saúde vira "Saúde"). Nunca nome, telefone ou e-mail do morador. */
  motivo: string;
  status: StatusVisita;
  horarioConfirmado: string | null;
  /** Remarcar: o horário que o dono propôs (o morador aceita ou cancela). */
  horarioProposto: string | null;
  motivoRecusa: string | null;
  linkChamada: string | null;
  criadoEm: string;
}

export interface MinhaVisita extends Omit<VisitaDono, "motivo"> {
  motivo: string;
  /** Endereço exato: SÓ na visita presencial confirmada e ainda não passada (regra de privacidade). */
  endereco: string | null;
  /** Link "Abrir no mapa" do endereço exato (mesma regra). */
  enderecoMapa: string | null;
}

type Linha = {
  id: string;
  property_id: string;
  modalidade: string | null;
  horario_proposto: string | null;
  motivo_recusa: string | null;
  horarios: string[];
  motivo: string | null;
  status: string;
  horario_confirmado: string | null;
  link_chamada: string | null;
  criado_em: string;
  property: { title: string | null } | null;
};

const COLUNAS =
  "id, property_id, modalidade, horarios, motivo, status, horario_confirmado, horario_proposto, motivo_recusa, link_chamada, criado_em, property:properties!visitas_video_property_id_fkey ( title )";

function mapear(r: Linha, rotulo: (m: string | null) => string): VisitaDono {
  return {
    id: r.id,
    imovel: r.property?.title ?? "Imóvel",
    propertyId: r.property_id,
    modalidade: ehModalidade(r.modalidade) ? r.modalidade : "video",
    horarios: r.horarios ?? [],
    motivo: rotulo(r.motivo),
    status: ehStatusVisita(r.status) ? r.status : "pedido",
    horarioConfirmado: r.horario_confirmado,
    horarioProposto: r.horario_proposto,
    motivoRecusa: r.motivo_recusa,
    linkChamada: r.link_chamada,
    criadoEm: r.criado_em,
  };
}

/** Pedidos dos imóveis do proprietário logado (RLS + filtro; tenant_id nem é legível). */
export async function listVisitasDono(): Promise<VisitaDono[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("visitas_video")
    .select(COLUNAS)
    .eq("owner_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as Linha[]).map((r) => mapear(r, (m) => motivoParaDono(m)));
}

/** Pedidos do morador logado. tenant_id não é legível pela sessão, então o servidor filtra com o id da sessão. */
export async function listMinhasVisitas(): Promise<MinhaVisita[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("visitas_video")
    .select(COLUNAS)
    .eq("tenant_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(100);
  const linhas = ((data ?? []) as unknown as Linha[]).map((r) => mapear(r, (m) => (m && isMotivo(m) ? motivoLabel(m) : "")));
  // Endereço exato só da visita PRESENCIAL CONFIRMADA e ainda não passada (o resto: só a região aproximada).
  const agora = new Date();
  const confirmadas = linhas.filter((v) => mostraEnderecoDaVisita(v, agora)).map((v) => v.propertyId);
  const enderecos = new Map<string, EnderecoVisita>();
  if (confirmadas.length) {
    const { data: props } = await admin.from("properties").select("id, exact_address, address, city, state, draft_data").in("id", confirmadas); // consistency-ignore: prompt 23 — endereço exato só ao morador da visita presencial CONFIRMADA
    for (const p of props ?? []) {
      const e = enderecoDaVisita(p);
      if (e) enderecos.set(p.id as string, e);
    }
  }
  return linhas.map((v) => {
    const e = mostraEnderecoDaVisita(v, agora) ? enderecos.get(v.propertyId) : undefined;
    return { ...v, endereco: e?.texto ?? null, enderecoMapa: e?.mapa ?? null };
  });
}

export type AcaoVisita = AcaoVisitaDono & { id: string };

/**
 * Responder um pedido: o dono confirma, propõe outro horário (Remarcar), recusa com motivo ou conclui; o morador
 * aceita a remarcação ou cancela. Quem age é decidido pela sessão, nunca pelo navegador. Avisa a outra parte.
 */
export async function responderVisitaVideo(entrada: AcaoVisita): Promise<Resultado> {
  return responderVisita(entrada);
}

export async function responderVisita(entrada: AcaoVisita): Promise<Resultado> {
  if (!entrada || typeof entrada.id !== "string") return { ok: false, error: "Pedido não encontrado." };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, needsAuth: true, error: "Entre para continuar." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };

  const { data: v } = await admin
    .from("visitas_video")
    .select("id, owner_id, tenant_id, property_id, status, modalidade, horario_proposto, link_chamada")
    .eq("id", entrada.id)
    .maybeSingle();
  if (!v) return { ok: false, error: "Pedido não encontrado." };
  const quem = v.owner_id === user.id ? "dono" : v.tenant_id === user.id ? "morador" : null;
  if (!quem) return { ok: false, error: "Sem permissão." };
  if (!ehStatusVisita(v.status)) return { ok: false, error: "Pedido inválido." };
  const modalidade: ModalidadeVisita = ehModalidade(v.modalidade) ? v.modalidade : "video";

  const m = mudancaDeStatus(v.status, quem, entrada, new Date(), {
    modalidade,
    horarioProposto: (v.horario_proposto as string | null) ?? null,
    linkChamada: (v.link_chamada as string | null) ?? null,
  });
  if (!m.ok) return { ok: false, error: m.error };
  const campos = m.campos;
  const { data: gravou, error } = await admin.from("visitas_video").update(campos).eq("id", v.id).eq("status", v.status).select("id");
  if (error) return { ok: false, error: erroBancoPT(error) };
  if (!gravou?.length) return { ok: false, error: "Este pedido mudou enquanto você respondia. Atualize a página." };

  // Aviso à OUTRA parte (prompt 23, item 6).
  const outro = (quem === "dono" ? v.tenant_id : v.owner_id) as string;
  const tipo = MODALIDADE_ROTULO[modalidade].toLowerCase();
  if (campos.status === "confirmado" && campos.horario_confirmado) {
    // Presencial confirmada pelo dono: o e-mail do MORADOR leva o endereço exato e "Abrir no mapa".
    let endereco: EnderecoVisita | null = null;
    if (quem === "dono" && modalidade === "presencial") {
      const { data: p } = await admin.from("properties").select("exact_address, address, city, state, draft_data").eq("id", v.property_id).maybeSingle(); // consistency-ignore: complemento do prompt 23 — endereço exato só ao morador da visita presencial CONFIRMADA
      endereco = p ? enderecoDaVisita(p) : null;
    }
    avisarVisita(admin, outro, "visita_confirmada", `Visita ${tipo} confirmada para ${formatarHorarioBrasilia(campos.horario_confirmado)}.`, endereco);
  } else if (campos.status === "remarcar" && campos.horario_proposto) {
    const { data: imovel } = await admin.from("properties").select("title").eq("id", v.property_id).maybeSingle();
    avisarVisita(admin, outro, "visita_remarcada", `O proprietário propôs outro horário para a visita ${tipo}: ${formatarHorarioBrasilia(campos.horario_proposto)}. Aceite ou cancele em Visitas.`, null, {
      imovel: (imovel?.title as string | null) ?? null,
      prazo: campos.horario_proposto,
      destinatarioEhParte: true,
    });
  } else if (campos.status === "cancelado") {
    avisarVisita(admin, outro, "visita_cancelada", `A visita ${tipo} foi cancelada${campos.motivo_recusa ? `. Motivo: ${campos.motivo_recusa}` : ""}.`);
  }
  // Sem isto a tela voltava com o status antigo: a resposta da ação chegava depois do router.refresh() do
  // navegador e trazia a árvore antiga (t168: gravava "confirmado" e continuava "Pedido enviado").
  revalidatePath("/dashboard/visitas");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/mensagens");
  return { ok: true };
}

/**
 * A visita em aberto entre mim e a outra pessoa da conversa, neste imóvel (cartão no topo da conversa, prompt 23).
 * Devolve só o que a tela mostra; o endereço exato segue a mesma regra (presencial confirmada, para o morador).
 */
export async function visitaDaConversa(propertyId: string, outroId: string): Promise<(MinhaVisita & { papel: "dono" | "morador" }) | null> {
  // Os ids entram no filtro do banco: só UUID (nada de texto livre no .or()).
  if (!UUID.test(String(propertyId)) || !UUID.test(String(outroId))) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("visitas_video")
    .select(`${COLUNAS}, owner_id, tenant_id`)
    .eq("property_id", propertyId)
    .or(`and(owner_id.eq.${user.id},tenant_id.eq.${outroId}),and(owner_id.eq.${outroId},tenant_id.eq.${user.id})`)
    .in("status", ["pedido", "remarcar", "confirmado"])
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Linha & { owner_id: string; tenant_id: string };
  const papel = r.owner_id === user.id ? "dono" : "morador";
  const v = mapear(r, (m) => (papel === "dono" ? motivoParaDono(m) : m && isMotivo(m) ? motivoLabel(m) : ""));
  let e: EnderecoVisita | null = null;
  if (papel === "morador" && mostraEnderecoDaVisita(v, new Date())) {
    const { data: p } = await admin.from("properties").select("exact_address, address, city, state, draft_data").eq("id", propertyId).maybeSingle(); // consistency-ignore: prompt 23 — endereço exato só ao morador da visita presencial CONFIRMADA
    e = p ? enderecoDaVisita(p) : null;
  }
  return { ...v, endereco: e?.texto ?? null, enderecoMapa: e?.mapa ?? null, papel };
}
