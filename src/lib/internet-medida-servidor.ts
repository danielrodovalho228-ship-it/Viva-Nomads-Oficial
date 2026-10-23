import "server-only";
import { ehPontoMedicao } from "@/config/niveis";
import { recalcularNivel } from "@/lib/niveis/servidor";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { notify, type NotificationEvent } from "@/lib/notifications";
import { INTERNET } from "@/config/internet";
import {
  dentroDoLimite,
  horaDeAvisarRemedicao,
  juntarRodadas,
  rodadaValida,
  sinalMorador,
  validarLocal,
  validoAte,
  type Medicao,
  type MotivoInvalida,
  type Rodada,
} from "@/lib/internet-medida";

type Admin = SupabaseClient;
export type Origem = "cadastro" | "edicao" | "conferencia_entrada";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIA = 86_400_000;

type Linha = { download_mbps: number | string; upload_mbps: number | string; latencia_ms: number; medido_em: string; valido_ate: string };
const medicaoDaLinha = (l: Linha): Medicao => ({
  downloadMbps: Number(l.download_mbps),
  uploadMbps: Number(l.upload_mbps),
  latenciaMs: Number(l.latencia_ms),
  medidoEm: l.medido_em,
  validoAte: l.valido_ate,
});

/** Papel de quem mede: o dono (cadastro/edição) ou o morador do contrato ativo (conferência de entrada). */
async function papelNoImovel(admin: Admin, userId: string, imovelId: string, origem: Origem): Promise<"dono" | "morador" | null> {
  const { data: p } = await admin.from("properties").select("owner_id").eq("id", imovelId).maybeSingle();
  if (!p) return null;
  if (origem !== "conferencia_entrada") return (p as { owner_id: string }).owner_id === userId ? "dono" : null;
  // Morador: inquilino de contrato ATIVO do imóvel (é quando a conferência de entrada aparece).
  const { data: c } = await admin.from("contratos").select("id").eq("property_id", imovelId).eq("tenant_id", userId).eq("status", "ativo").limit(1);
  return (c ?? []).length ? "morador" : null;
}

export async function coordenadasDoImovel(admin: Admin, imovelId: string): Promise<{ lat: number; lng: number } | null> {
  const { data } = await admin.from("properties").select("lat, lng, lat_exata, lng_exata").eq("id", imovelId).maybeSingle();
  const r = data as { lat: number | null; lng: number | null; lat_exata: number | null; lng_exata: number | null } | null;
  if (!r) return null;
  // A coordenada exata (privada) é a que vale; a pública é aproximada.
  const lat = r.lat_exata ?? r.lat;
  const lng = r.lng_exata ?? r.lng;
  return lat != null && lng != null && !(lat === 0 && lng === 0) ? { lat, lng } : null;
}

async function medicoesHoje(admin: Admin, imovelId: string, agora: Date): Promise<number> {
  const { count } = await admin
    .from("internet_medicoes")
    .select("id", { count: "exact", head: true })
    .eq("property_id", imovelId)
    .gte("medido_em", new Date(agora.getTime() - DIA).toISOString());
  return count ?? 0;
}

/** A última medição VALIDADA e vigente do dono (servidor; inclui rascunho, para o próprio dono ver). */
export async function ultimaMedidaDoDono(admin: Admin, imovelId: string, agora: Date): Promise<Medicao | null> {
  const { data } = await admin
    .from("internet_medicoes")
    .select("download_mbps, upload_mbps, latencia_ms, medido_em, valido_ate")
    .eq("property_id", imovelId)
    .eq("papel", "dono")
    .eq("validada", true)
    .gt("valido_ate", agora.toISOString())
    .order("medido_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? medicaoDaLinha(data as Linha) : null;
}

/** Leitura pública (página do imóvel publicado): a view só devolve a última validada do dono, vigente. */
export async function medidaPublica(imovelId: string): Promise<Medicao | null> {
  if (!UUID.test(imovelId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("internet_medida_publica")
    .select("download_mbps, upload_mbps, latencia_ms, medido_em, valido_ate")
    .eq("property_id", imovelId)
    .maybeSingle();
  return data ? medicaoDaLinha(data as Linha) : null;
}

/** Para a busca/qualificação: a medição pública de vários imóveis de uma vez. */
export async function medidasPublicas(ids: string[]): Promise<Map<string, Medicao>> {
  const m = new Map<string, Medicao>();
  const validos = ids.filter((id) => UUID.test(id));
  if (!validos.length) return m;
  const supabase = await createClient();
  if (!supabase) return m;
  const { data } = await supabase
    .from("internet_medida_publica")
    .select("property_id, download_mbps, upload_mbps, latencia_ms, medido_em, valido_ate")
    .in("property_id", validos);
  for (const l of (data ?? []) as (Linha & { property_id: string })[]) m.set(l.property_id, medicaoDaLinha(l));
  return m;
}

async function avisarUsuario(admin: Admin, destino: string, ev: NotificationEvent, url: string) {
  try {
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", destino).maybeSingle();
    const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    await notify({ event: ev, email: d?.notif_email === false ? undefined : (d?.email ?? undefined), name: d?.full_name ?? undefined, userId: destino, pushUrl: url });
  } catch {
    /* aviso é complemento */
  }
}

export type EstadoMedir =
  | { ok: false; erro: string }
  | { ok: true; papel: "dono" | "morador"; simulado: boolean; restantesHoje: number; ultima: Medicao | null; temCoordenadas: boolean };

/** O que o botão precisa saber antes de medir. */
export async function estadoParaMedir(imovelId: string, origem: Origem): Promise<EstadoMedir> {
  if (!UUID.test(imovelId)) return { ok: false, erro: "Imóvel inválido." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, erro: "Indisponível agora." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta para medir." };
  const papel = await papelNoImovel(admin, user.id, imovelId, origem);
  if (!papel) return { ok: false, erro: "Só o proprietário do imóvel (ou o morador, na conferência de entrada) mede a internet." };
  const agora = new Date();
  return {
    ok: true,
    papel,
    simulado: integracoesSimuladas(),
    restantesHoje: Math.max(0, INTERNET.limitePorDia - (await medicoesHoje(admin, imovelId, agora))),
    ultima: papel === "dono" ? await ultimaMedidaDoDono(admin, imovelId, agora) : null,
    temCoordenadas: !!(await coordenadasDoImovel(admin, imovelId)),
  };
}

export type ResultadoMedicao =
  | { ok: false; erro: string }
  | { ok: true; validada: boolean; motivo: MotivoInvalida | null; medicao: Rodada & { medidoEm: string; validoAte: string } };

/**
 * Registra uma medição. O navegador manda as rodadas e (se permitido) a posição do aparelho; o servidor confere a
 * sessão, o papel, o limite do dia e a distância ao imóvel, junta pela mediana e grava. A posição do aparelho não é
 * gravada: só a distância em metros.
 */
export async function registrarMedicao(entrada: {
  imovelId: unknown;
  origem: unknown;
  rodadas: unknown;
  local: unknown;
  confirmouWifi: unknown;
  /** Adendo 59.1: onde foi medido (quarto principal, ponto de trabalho, sala, outro). Declarado; o morador confere. */
  ponto?: unknown;
}): Promise<ResultadoMedicao> {
  const imovelId = String(entrada.imovelId ?? "");
  const origem = entrada.origem as Origem;
  if (!UUID.test(imovelId) || !["cadastro", "edicao", "conferencia_entrada"].includes(origem)) return { ok: false, erro: "Pedido inválido." };
  const rodadas = Array.isArray(entrada.rodadas) ? entrada.rodadas.slice(0, INTERNET.rodadas).filter(rodadaValida) : [];
  const junta = juntarRodadas(rodadas);
  if (!junta) return { ok: false, erro: "A medição não terminou. Tente de novo." };

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, erro: "Indisponível agora." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta para medir." };
  const papel = await papelNoImovel(admin, user.id, imovelId, origem);
  if (!papel) return { ok: false, erro: "Só o proprietário do imóvel (ou o morador, na conferência de entrada) mede a internet." };
  const agora = new Date();
  if (!dentroDoLimite(await medicoesHoje(admin, imovelId, agora))) return { ok: false, erro: `Limite de ${INTERNET.limitePorDia} medições por dia neste imóvel. Tente amanhã.` };

  const l = entrada.local as { lat?: unknown; lng?: unknown } | null;
  const aparelho = l && typeof l.lat === "number" && typeof l.lng === "number" ? { lat: l.lat, lng: l.lng } : null;
  const local = validarLocal(aparelho, await coordenadasDoImovel(admin, imovelId), entrada.confirmouWifi === true);
  const ate = validoAte(agora);
  const { error } = await admin.from("internet_medicoes").insert({
    property_id: imovelId,
    user_id: user.id,
    papel,
    download_mbps: junta.downloadMbps,
    upload_mbps: junta.uploadMbps,
    latencia_ms: junta.latenciaMs,
    distancia_m: local.distanciaM,
    validada: local.validada,
    motivo_invalida: local.motivo,
    origem,
    medido_em: agora.toISOString(),
    valido_ate: ate.toISOString(),
    ...(ehPontoMedicao(entrada.ponto) ? { ponto: entrada.ponto } : {}),
  });
  if (error) return { ok: false, erro: "Não deu para salvar a medição agora." };
  // A página do imóvel é ISR (revalidate 60 s): a medição validada do dono aparece já, sem esperar o ciclo.
  if (papel === "dono" && local.validada) revalidatePath(`/imoveis/${imovelId}`);
  // A medida por ponto do dono entra no nível (internet de Conforto/Premium).
  if (papel === "dono" && ehPontoMedicao(entrada.ponto)) await recalcularNivel(admin, imovelId, agora);

  // Morador abaixo de 50% da medição do dono: sinal no painel de qualidade e aviso ao dono (sem acusar ninguém).
  if (papel === "morador" && local.validada) {
    const dono = await ultimaMedidaDoDono(admin, imovelId, agora);
    if (sinalMorador(dono, junta)) {
      const { data: p } = await admin.from("properties").select("owner_id").eq("id", imovelId).maybeSingle();
      const ownerId = (p as { owner_id: string } | null)?.owner_id;
      if (ownerId) await avisarUsuario(admin, ownerId, "internet_abaixo_medida", `/dashboard/imoveis/${imovelId}/editar#internet`);
    }
  }
  return { ok: true, validada: local.validada, motivo: local.motivo, medicao: { ...junta, medidoEm: agora.toISOString(), validoAte: ate.toISOString() } };
}

/** Sinal do painel de qualidade: a última medição validada do morador ficou abaixo de 50% da do dono vigente. */
export async function sinalInternetMorador(admin: Admin, imovelId: string, agora: Date): Promise<boolean> {
  const dono = await ultimaMedidaDoDono(admin, imovelId, agora);
  if (!dono) return false;
  const { data } = await admin
    .from("internet_medicoes")
    .select("download_mbps, upload_mbps, latencia_ms, medido_em, valido_ate")
    .eq("property_id", imovelId)
    .eq("papel", "morador")
    .eq("validada", true)
    .gt("medido_em", dono.medidoEm)
    .order("medido_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? sinalMorador(dono, medicaoDaLinha(data as Linha)) : false;
}

/** Cron diário: "Meça de novo a internet de [imóvel]" aos ~5,5 meses, uma vez por medição. */
export async function avisosDeRemedicao(admin: Admin, agora: Date, simular = false): Promise<{ avisosInternet: number }> {
  const desde = new Date(agora.getTime() - INTERNET.avisoAposDias * DIA).toISOString();
  const { data } = await admin
    .from("internet_medicoes")
    .select("id, property_id, medido_em, valido_ate, properties!inner(owner_id, title)")
    .eq("papel", "dono")
    .eq("validada", true)
    .is("avisado_remedir_em", null)
    .lte("medido_em", desde)
    .gt("valido_ate", agora.toISOString())
    .limit(500);
  let avisos = 0;
  const vistos = new Set<string>();
  for (const l of (data ?? []) as unknown as { id: string; property_id: string; medido_em: string; valido_ate: string; properties: { owner_id: string } }[]) {
    if (!horaDeAvisarRemedicao({ medidoEm: l.medido_em, validoAte: l.valido_ate }, agora)) continue;
    if (simular) {
      if (!vistos.has(l.property_id)) avisos += 1;
      vistos.add(l.property_id);
      continue;
    }
    // Marca primeiro (uma vez por medição), depois avisa uma vez por imóvel.
    const { data: marcada } = await admin.from("internet_medicoes").update({ avisado_remedir_em: agora.toISOString() }).eq("id", l.id).is("avisado_remedir_em", null).select("id");
    if (!(marcada ?? []).length || vistos.has(l.property_id)) continue;
    vistos.add(l.property_id);
    await avisarUsuario(admin, l.properties.owner_id, "internet_remedir", `/dashboard/imoveis/${l.property_id}/editar#internet`);
    avisos += 1;
  }
  return { avisosInternet: avisos };
}
