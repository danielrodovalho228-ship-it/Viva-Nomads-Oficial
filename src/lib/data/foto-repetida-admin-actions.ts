"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { recusaObservador } from "@/lib/qa/observador";

/**
 * E640 (b) — fila do admin das fotos iguais às de outro anúncio. A publicação do imóvel fica travada até a matrícula ser
 * conferida (a conferência da matrícula já destrava sozinha); o admin pode liberar à mão depois de conferir por fora.
 * O dono NUNCA vê de quem é a outra foto: só o admin lê esta lista.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FotoRepetidaNaFila {
  propertyId: string;
  imovel: string;
  dono: string;
  fotos: number;
  abertoEm: string;
}

async function soAdmin() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return null;
  return { supabase, admin, user };
}

export async function listarFotosRepetidas(): Promise<FotoRepetidaNaFila[]> {
  const ctx = await soAdmin();
  if (!ctx) return [];
  const { data, error } = await ctx.admin.from("fotos_repetidas_alertas").select("property_id, owner_id, criado_em").eq("status", "aberto").order("criado_em");
  if (error) throw new Error("Não foi possível ler as fotos repetidas agora.");
  const linhas = (data ?? []) as { property_id: string; owner_id: string; criado_em: string }[];
  if (!linhas.length) return [];
  const ids = [...new Set(linhas.map((l) => l.property_id))];
  const donos = [...new Set(linhas.map((l) => l.owner_id))];
  const [{ data: imoveis }, { data: perfis }] = await Promise.all([
    ctx.admin.from("properties").select("id, title").in("id", ids),
    ctx.admin.from("profiles").select("id, full_name").in("id", donos),
  ]);
  const titulo = new Map(((imoveis ?? []) as { id: string; title: string | null }[]).map((i) => [i.id, i.title ?? "Imóvel"]));
  const nome = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name?.trim() || "Sem nome"]));
  return ids.map((id) => {
    const dele = linhas.filter((l) => l.property_id === id);
    return { propertyId: id, imovel: titulo.get(id) ?? "Imóvel", dono: nome.get(dele[0].owner_id) ?? "Sem nome", fotos: dele.length, abertoEm: dele[0].criado_em };
  });
}

/** Libera a publicação (a equipe conferiu a matrícula): fecha os alertas do imóvel e limpa o marcador. */
export async function liberarFotoRepetida(propertyId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!UUID_RE.test(propertyId)) return { ok: false, erro: "Imóvel inválido." };
  const ctx = await soAdmin();
  if (!ctx) return { ok: false, erro: "Sem permissão." };
  const recusaQa = await recusaObservador(ctx.user.id, { imoveis: [propertyId] });
  if (recusaQa) return { ok: false, erro: recusaQa };
  const agora = new Date().toISOString();
  const { error } = await ctx.admin
    .from("fotos_repetidas_alertas")
    .update({ status: "liberado", liberado_em: agora, liberado_por: ctx.user.id })
    .eq("property_id", propertyId)
    .eq("status", "aberto");
  if (error) return { ok: false, erro: "Não foi possível liberar agora." };
  const { error: e2 } = await ctx.admin.from("properties").update({ foto_repetida_em: null }).eq("id", propertyId);
  if (e2) return { ok: false, erro: "Não foi possível liberar agora." };
  await logModeracao(ctx.admin, ctx.user.id, "foto_repetida_liberada", "properties", propertyId, "matrícula conferida");
  revalidatePath("/admin/documentos");
  return { ok: true };
}
