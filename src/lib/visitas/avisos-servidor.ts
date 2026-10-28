import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { formatarHorarioBrasilia, MODALIDADE_ROTULO, ehModalidade, type ModalidadeVisita } from "@/lib/visitas-video";
import { enderecoDaVisita } from "./endereco-visita";
import {
  MOTIVO_EXPIROU,
  TEXTO_EXPIRADA_DONO,
  TEXTO_EXPIRADA_MORADOR,
  detalhes,
  pedidoDeVisitaExpirou,
  vesperaDaVisita,
  vesperaTexto,
  visitaCancelada,
} from "@/lib/notifications/emails-e205b";

/*
  E205-B (d) — avisos de visita: cancelada (quem, motivo, horário), EXPIRADA (todos os horários propostos passaram
  sem confirmação → "cancelado" com motivo "expirou"; sem status novo, sem migração) e VÉSPERA (~24 h antes; se a
  confirmação vier com menos de 24 h, sai na hora). Best-effort: aviso nunca quebra o fluxo.
*/

type Admin = SupabaseClient;

interface LinhaVisita {
  id: string;
  property_id: string;
  owner_id: string;
  tenant_id: string;
  modalidade: string;
  status: string;
  horarios: string[] | null;
  horario_confirmado: string | null;
  link_chamada: string | null;
  motivo_recusa: string | null;
}

const COLUNAS = "id, property_id, owner_id, tenant_id, modalidade, status, horarios, horario_confirmado, link_chamada, motivo_recusa";

async function perfil(admin: Admin, id: string) {
  const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", id).maybeSingle();
  return data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
}

async function imovel(admin: Admin, id: string) {
  const { data } = await admin.from("properties").select("title").eq("id", id).maybeSingle();
  return data as { title: string | null } | null;
}

/** Endereço exato: SÓ para a véspera presencial do morador (a mesma regra de endereco-visita.ts). */
async function enderecoExato(admin: Admin, id: string) {
  const { data: p } = await admin.from("properties").select("exact_address, address, city, state, draft_data").eq("id", id).maybeSingle(); // consistency-ignore: E205-B — endereço exato só ao morador da visita presencial confirmada (véspera)
  return p ? enderecoDaVisita(p) : null;
}

const tipoDe = (v: LinhaVisita) => MODALIDADE_ROTULO[ehModalidade(v.modalidade) ? v.modalidade : "video"].toLowerCase();

/** O horário que a visita tinha: o confirmado; senão, os propostos. */
function horarioDe(v: LinhaVisita): string {
  if (v.horario_confirmado) return formatarHorarioBrasilia(v.horario_confirmado);
  return (v.horarios ?? []).map(formatarHorarioBrasilia).filter(Boolean).join("; ");
}

/** Cancelada (pelo dono ou pelo morador): à OUTRA parte, com quem cancelou, o motivo e o horário. */
export async function avisarVisitaCancelada(admin: Admin, visitaId: string, quemCancelou: "dono" | "morador"): Promise<void> {
  try {
    const { data } = await admin.from("visitas_video").select(COLUNAS).eq("id", visitaId).maybeSingle();
    const v = data as LinhaVisita | null;
    if (!v) return;
    const para = quemCancelou === "dono" ? v.tenant_id : v.owner_id;
    const de = quemCancelou === "dono" ? v.owner_id : v.tenant_id;
    const [destino, autor, im] = await Promise.all([perfil(admin, para), perfil(admin, de), imovel(admin, v.property_id)]);
    if (!destino?.email || destino.notif_email === false) return;
    const t = visitaCancelada({
      quemCancelou,
      nomeDeQuemCancelou: autor?.full_name,
      motivo: v.motivo_recusa,
      horario: horarioDe(v),
      tipo: tipoDe(v),
      imovel: im?.title,
      propertyId: v.property_id,
      paraMorador: para === v.tenant_id,
    });
    const d = detalhes({ linhas: t.linhas });
    await notify({ event: "visita_cancelada", email: destino.email, name: destino.full_name ?? undefined, userId: para, pushUrl: t.url, body: t.abertura, ctaLabel: t.cta, detailsHtml: d.html, detailsText: d.texto });
  } catch {
    /* best-effort */
  }
}

/**
 * Expira os pedidos de visita cujos horários propostos passaram todos sem confirmação: status "cancelado", motivo
 * "expirou", e-mail aos dois lados. O update é condicional (status ainda "pedido"): roda de novo sem repetir aviso.
 * `filtro`: só as visitas de uma pessoa (a tela aplica a regra na hora; o cron passa por todas).
 */
export async function expirarVisitasVencidas(admin: Admin, agora: Date, o: { simular?: boolean; usuarioId?: string } = {}): Promise<number> {
  let q = admin.from("visitas_video").select(COLUNAS).eq("status", "pedido").limit(500);
  if (o.usuarioId && !/^[0-9a-f-]{36}$/i.test(o.usuarioId)) return 0; // só UUID entra no filtro
  if (o.usuarioId) q = q.or(`owner_id.eq.${o.usuarioId},tenant_id.eq.${o.usuarioId}`);
  const { data } = await q;
  const vencidas = ((data ?? []) as LinhaVisita[]).filter((v) => pedidoDeVisitaExpirou({ status: v.status, horarios: v.horarios ?? [] }, agora));
  if (o.simular) return vencidas.length;
  let n = 0;
  for (const v of vencidas) {
    const { data: ok } = await admin
      .from("visitas_video")
      .update({ status: "cancelado", motivo_recusa: MOTIVO_EXPIROU, atualizado_em: agora.toISOString() })
      .eq("id", v.id)
      .eq("status", "pedido")
      .select("id");
    if (!ok?.length) continue;
    n += 1;
    await avisarExpirada(admin, v).catch(() => null);
  }
  return n;
}

async function avisarExpirada(admin: Admin, v: LinhaVisita): Promise<void> {
  const im = await imovel(admin, v.property_id);
  const linhas = [...(im?.title ? [{ rotulo: "Imóvel", valor: im.title }] : []), { rotulo: "Visita", valor: tipoDe(v) }, { rotulo: "Horários propostos", valor: horarioDe(v) }];
  const d = detalhes({ linhas });
  for (const [para, texto, cta, url] of [
    [v.tenant_id, TEXTO_EXPIRADA_MORADOR, "Pedir outros horários", `/imoveis/${v.property_id}`],
    [v.owner_id, TEXTO_EXPIRADA_DONO, "Ver as visitas", "/dashboard/visitas?de=dono"],
  ] as const) {
    const p = await perfil(admin, para);
    if (!p?.email || p.notif_email === false) continue;
    await notify({
      event: "visita_expirada",
      email: p.email,
      name: p.full_name ?? undefined,
      userId: para,
      pushUrl: url,
      body: (n?: string) => `Olá${n ? " " + n : ""}, ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`,
      ctaLabel: cta,
      detailsHtml: d.html,
      detailsText: d.texto,
    }).catch(() => null);
  }
}

export const CHAVE_VESPERA = (visitaId: string, usuarioId: string, horario: string) => `visita_vespera:${visitaId}:${usuarioId}:${horario}`;

/** Véspera de UMA visita (os dois lados), se for a hora. A chave de envio garante uma vez por pessoa e horário. */
export async function vesperaDaVisitaSeFor(admin: Admin, visitaId: string, agora: Date): Promise<number> {
  const { data } = await admin.from("visitas_video").select(COLUNAS).eq("id", visitaId).maybeSingle();
  const v = data as LinhaVisita | null;
  if (!v || !vesperaDaVisita({ status: v.status, horarioConfirmado: v.horario_confirmado }, agora)) return 0;
  return enviarVespera(admin, v);
}

async function enviarVespera(admin: Admin, v: LinhaVisita): Promise<number> {
  const modalidade: ModalidadeVisita = ehModalidade(v.modalidade) ? v.modalidade : "video";
  const horario = formatarHorarioBrasilia(v.horario_confirmado!);
  const [im, morador] = await Promise.all([imovel(admin, v.property_id), perfil(admin, v.tenant_id)]);
  let n = 0;
  for (const para of [v.tenant_id, v.owner_id]) {
    const paraMorador = para === v.tenant_id;
    const p = paraMorador ? morador : await perfil(admin, para);
    if (!p?.email || p.notif_email === false) continue;
    const { error } = await admin.from("automacoes_envios").insert({ chave: CHAVE_VESPERA(v.id, para, v.horario_confirmado!), tipo: "visita_vespera", usuario_id: para });
    if (error) continue; // já saiu
    // Endereço exato: só presencial, confirmada, não passada, só ao morador (regra de endereco-visita.ts).
    const endereco = modalidade === "presencial" && paraMorador ? await enderecoExato(admin, v.property_id) : null;
    const t = vesperaTexto({ modalidade, paraMorador, horario, imovel: im?.title, nomeMorador: morador?.full_name, endereco, linkChamada: v.link_chamada });
    const externo = /^https:\/\//.test(t.url) ? { label: t.cta, url: t.url } : null;
    const d = detalhes({ linhas: t.linhas, externo });
    await notify({
      event: "visita_vespera",
      email: p.email,
      name: p.full_name ?? undefined,
      userId: para,
      pushUrl: externo ? "/dashboard/visitas" : t.url,
      body: t.abertura,
      ctaLabel: externo ? undefined : t.cta,
      detailsHtml: d.html,
      detailsText: d.texto,
    }).catch(() => null);
    n += 1;
  }
  return n;
}

/** Cron: a véspera de todas as visitas confirmadas nas próximas 24 h. `simular`: só conta. */
export async function vesperasDasVisitas(admin: Admin, agora: Date, simular: boolean): Promise<number> {
  const ate = new Date(agora.getTime() + 24 * 3600_000).toISOString();
  const { data } = await admin.from("visitas_video").select(COLUNAS).eq("status", "confirmado").gt("horario_confirmado", agora.toISOString()).lte("horario_confirmado", ate).limit(500);
  const linhas = ((data ?? []) as LinhaVisita[]).filter((v) => vesperaDaVisita({ status: v.status, horarioConfirmado: v.horario_confirmado }, agora));
  if (simular) return linhas.length;
  let n = 0;
  for (const v of linhas) n += await enviarVespera(admin, v).catch(() => 0);
  return n;
}
