"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isExemplo, EXEMPLO_AVISO_DEMO } from "@/lib/demo-listing";
import { isMotivo, motivoLabel, motivoParaDono } from "@/lib/pedidos/pedidos";
import { erroBancoPT } from "@/lib/erros-banco";
import {
  ehStatusVisita,
  podeTransicionar,
  validarHorarios,
  validarLinkChamada,
  type StatusVisita,
} from "@/lib/visitas-video";

interface Resultado {
  ok: boolean;
  error?: string;
  demo?: boolean;
  needsAuth?: boolean;
}

/** Morador pede a visita por vídeo. Autoridade no servidor: horários, dono do imóvel e anúncio de exemplo. */
export async function pedirVisitaVideo(propertyId: string, horarios: unknown, motivo?: string): Promise<Resultado> {
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
  if (!user) return { ok: false, needsAuth: true, error: "Entre para pedir a visita por vídeo." };

  const { data: prop } = await supabase.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
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
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Você já tem um pedido em aberto para este imóvel." };
    return { ok: false, error: erroBancoPT(error) };
  }
  return { ok: true };
}

export interface VisitaDono {
  id: string;
  imovel: string;
  horarios: string[];
  /** Rótulo do motivo da estadia (saúde vira "Saúde"). Nunca nome, telefone ou e-mail do morador. */
  motivo: string;
  status: StatusVisita;
  horarioConfirmado: string | null;
  linkChamada: string | null;
  criadoEm: string;
}

export interface MinhaVisita extends Omit<VisitaDono, "motivo"> {
  motivo: string;
}

type Linha = {
  id: string;
  horarios: string[];
  motivo: string | null;
  status: string;
  horario_confirmado: string | null;
  link_chamada: string | null;
  criado_em: string;
  property: { title: string | null } | null;
};

const COLUNAS =
  "id, horarios, motivo, status, horario_confirmado, link_chamada, criado_em, property:properties!visitas_video_property_id_fkey ( title )";

function mapear(r: Linha, rotulo: (m: string | null) => string): VisitaDono {
  return {
    id: r.id,
    imovel: r.property?.title ?? "Imóvel",
    horarios: r.horarios ?? [],
    motivo: rotulo(r.motivo),
    status: ehStatusVisita(r.status) ? r.status : "pedido",
    horarioConfirmado: r.horario_confirmado,
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
  return ((data ?? []) as unknown as Linha[]).map((r) => mapear(r, (m) => (m && isMotivo(m) ? motivoLabel(m) : "")));
}

export type AcaoVisita =
  | { acao: "confirmar"; id: string; horario: string; link: string }
  | { acao: "concluir" | "cancelar"; id: string };

/** Dono confirma/conclui; dono ou morador cancela. Quem age é decidido pela sessão, nunca pelo navegador. */
export async function responderVisitaVideo(entrada: AcaoVisita): Promise<Resultado> {
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
    .select("id, owner_id, tenant_id, status")
    .eq("id", entrada.id)
    .maybeSingle();
  if (!v) return { ok: false, error: "Pedido não encontrado." };
  const quem = v.owner_id === user.id ? "dono" : v.tenant_id === user.id ? "morador" : null;
  if (!quem) return { ok: false, error: "Sem permissão." };
  if (!ehStatusVisita(v.status)) return { ok: false, error: "Pedido inválido." };

  const para: StatusVisita = entrada.acao === "confirmar" ? "confirmado" : entrada.acao === "concluir" ? "feito" : "cancelado";
  if (!podeTransicionar(v.status, para, quem)) return { ok: false, error: "Este pedido não pode mais ser alterado." };

  const campos: Record<string, unknown> = { status: para, atualizado_em: new Date().toISOString() };
  if (entrada.acao === "confirmar") {
    const link = validarLinkChamada(entrada.link);
    if (!link.ok) return { ok: false, error: link.error };
    // Um dos horários pedidos ou outro proposto pelo dono (a partir de agora, até 14 dias).
    const alvo = Date.parse(entrada.horario);
    const agora = Date.now();
    if (!Number.isFinite(alvo) || alvo <= agora || alvo > agora + 14 * 24 * 3600_000)
      return { ok: false, error: "Escolha um horário nos próximos 14 dias." };
    campos.horario_confirmado = new Date(alvo).toISOString();
    campos.link_chamada = link.url;
  }
  const { error } = await admin.from("visitas_video").update(campos).eq("id", v.id).eq("status", v.status);
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true };
}
