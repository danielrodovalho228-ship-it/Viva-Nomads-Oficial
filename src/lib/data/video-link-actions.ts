"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { consumirLimite, DIA } from "@/lib/limites";
import { ACAO_APROVAR_VIDEO, ACAO_RECUSAR_VIDEO, ALVO_VIDEO, type ResultadoLink } from "@/lib/fotos/conteudo";
import { verificarLinkVideo } from "./video-link";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O dono cola o link: confere formato, existência e incorporação (com limite diário por pessoa). */
export async function conferirLinkVideo(url: string): Promise<ResultadoLink> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre para continuar." };
  if (!(await consumirLimite(`video-link:user:${user.id}`, 60, DIA))) return { ok: false, erro: "Limite de conferências de link de hoje atingido." };
  return verificarLinkVideo(String(url ?? "").trim());
}

export interface LinkPendente {
  propertyId: string;
  titulo: string;
  url: string;
}

async function adminComSessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (perfil?.role !== "admin" || !(await sessaoAal2(supabase))) return null;
  return { supabase, uid: user.id };
}

/** Admin: anúncios com link de vídeo ainda sem decisão para ESTE link (o anúncio não o mostra até aprovar). */
export async function listarLinksDeVideoPendentes(): Promise<LinkPendente[]> {
  const a = await adminComSessao();
  const admin = createAdminClient();
  if (!a || !admin) return [];
  const { data: props } = await admin.from("properties").select("id, title, video_url").not("video_url", "is", null).neq("status", "draft").limit(200);
  const linhas = ((props ?? []) as { id: string; title: string | null; video_url: string | null }[]).filter((p) => p.video_url?.trim());
  if (!linhas.length) return [];
  const { data: decisoes } = await admin.from("moderacao_log").select("alvo_id, acao, motivo, criado_em").eq("alvo_tipo", ALVO_VIDEO).in("alvo_id", linhas.map((l) => l.id));
  const porImovel = new Map<string, { acao: string; motivo: string | null; criado_em: string }[]>();
  for (const d of (decisoes ?? []) as { alvo_id: string; acao: string; motivo: string | null; criado_em: string }[]) porImovel.set(d.alvo_id, [...(porImovel.get(d.alvo_id) ?? []), d]);
  return linhas
    .filter((l) => !(porImovel.get(l.id) ?? []).some((d) => d.motivo === l.video_url))
    .map((l) => ({ propertyId: l.id, titulo: l.title || "Imóvel", url: l.video_url! }));
}

/** Admin aprova (o anúncio passa a mostrar o vídeo) ou recusa (continua escondido). Grava no moderacao_log. */
export async function decidirLinkDeVideo(propertyId: string, url: string, aprovar: boolean): Promise<{ ok: boolean; erro?: string }> {
  if (!UUID.test(propertyId ?? "")) return { ok: false, erro: "Anúncio inválido." };
  const a = await adminComSessao();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const admin = createAdminClient();
  const { data: p } = admin ? await admin.from("properties").select("video_url").eq("id", propertyId).maybeSingle() : { data: null };
  if (!p || p.video_url !== url) return { ok: false, erro: "O link deste anúncio mudou. Atualize a página." };
  await logModeracao(a.supabase, a.uid, aprovar ? ACAO_APROVAR_VIDEO : ACAO_RECUSAR_VIDEO, ALVO_VIDEO, propertyId, url);
  revalidatePath("/admin/imoveis");
  revalidatePath(`/imoveis/${propertyId}`);
  return { ok: true };
}
