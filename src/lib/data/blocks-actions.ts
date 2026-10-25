"use server";

import { createClient } from "@/lib/supabase/server";
import { erroBancoPT } from "@/lib/erros-banco";
import { createAdminClient } from "@/lib/supabase/admin";
import { periodosOcupados } from "@/lib/data/periodo-servidor";
import { segredoCalendario, urlExportacaoCalendario } from "@/lib/calendario/ical";
import { SITE_URL } from "@/lib/site";

export interface BlocoDatas {
  id: string;
  inicio: string; // ISO
  fim: string; // ISO
  /** Prompt 53: "importado" veio do calendário de outro site (só a sincronia mexe); "manual" o dono bloqueou. */
  origem?: "manual" | "importado";
}

type ActionResult = { ok: boolean; demo?: boolean; error?: string; id?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Datas bloqueadas de um imóvel (leitura pública). [] em demo/sem backend. */
export async function getBlocks(propertyId: string): Promise<BlocoDatas[]> {
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(propertyId)) return [];
  const { data } = await supabase
    .from("property_blocks")
    .select("id, inicio, fim, origem")
    .eq("property_id", propertyId)
    .order("inicio", { ascending: true });
  return ((data ?? []) as { id: string; inicio: string; fim: string; origem?: string | null }[]).map((b) => ({
    id: String(b.id),
    inicio: String(b.inicio),
    fim: String(b.fim),
    origem: b.origem === "importado" ? "importado" : "manual",
  }));
}

/**
 * Datas indisponíveis no calendário público: os bloqueios do dono + os períodos com contrato ativo (0176). Só datas —
 * nunca quem mora. [] em demo/sem backend.
 */
export async function getDatasIndisponiveis(propertyId: string): Promise<{ inicio: string; fim: string }[]> {
  if (!UUID_RE.test(propertyId)) return [];
  const bloqueios = (await getBlocks(propertyId)).map((b) => ({ inicio: b.inicio, fim: b.fim }));
  const admin = createAdminClient();
  const contratos = admin ? await periodosOcupados(admin, propertyId).catch(() => []) : [];
  return [...bloqueios, ...contratos];
}

/** Proprietário BLOQUEIA um intervalo. RLS garante que só o dono insere. */
export async function addBlock(
  propertyId: string,
  inicio: string,
  fim: string
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para bloquear datas." };
  if (!UUID_RE.test(propertyId)) return { ok: true, demo: true };
  if (!inicio || !fim || fim < inicio)
    return { ok: false, error: "Intervalo de datas inválido." };

  // E137: idempotente — o mesmo período já bloqueado (toque duplo, dois envios) devolve o bloqueio que existe.
  const { data: igual } = await supabase
    .from("property_blocks")
    .select("id")
    .eq("property_id", propertyId)
    .eq("inicio", inicio)
    .eq("fim", fim)
    .limit(1)
    .maybeSingle();
  if (igual?.id) return { ok: true, id: String(igual.id) };

  const { data, error } = await supabase
    .from("property_blocks")
    .insert({ property_id: propertyId, inicio, fim })
    .select("id")
    .single();
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true, id: data?.id };
}

/** Remove um bloqueio (RLS: só o dono). */
export async function removeBlock(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  if (!UUID_RE.test(id)) return { ok: true, demo: true };
  const { error } = await supabase.from("property_blocks").delete().eq("id", id);
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true };
}

/**
 * E44: link de EXPORTAÇÃO do calendário (.ics) para o dono colar no Airbnb/Booking. Só o dono do imóvel recebe o link
 * (ele é secreto: quem tem o link vê as datas ocupadas). Demo/anúncio de exemplo: sem link.
 */
export async function linkExportacaoCalendario(propertyId: string): Promise<{ ok: boolean; demo?: boolean; url?: string; error?: string }> {
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(propertyId)) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para ver o link do calendário." };
  const { data: imovel } = await supabase.from("properties").select("id").eq("id", propertyId).eq("owner_id", user.id).maybeSingle();
  if (!imovel) return { ok: false, error: "Só o dono do imóvel vê o link do calendário." };
  const url = urlExportacaoCalendario(SITE_URL, propertyId, segredoCalendario());
  return url ? { ok: true, url } : { ok: false, error: "O link do calendário não está disponível agora." };
}
