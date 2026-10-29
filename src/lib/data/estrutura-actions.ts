"use server";

/*
  Selos de estrutura (ordem 512f3ed0, parte 2): o dono grava o checklist de Acessível e de Mobilidade reduzida.
  Quem age é conferido no servidor (só o dono do anúncio); o checklist é validado por chave e tipo antes de gravar.
*/
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarChecklistEstrutura, type ChecklistEstrutura } from "@/lib/selos-estrutura";

export type ResultadoEstrutura = { ok: true } | { ok: false; erro: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function salvarChecklistEstrutura(propertyId: string, checklist: unknown): Promise<ResultadoEstrutura> {
  if (!UUID.test(propertyId ?? "")) return { ok: false, erro: "Sem permissão." };
  const v = validarChecklistEstrutura(checklist);
  if (!v.ok) return v;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, erro: "Não foi possível salvar agora." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const { data: imovel } = await supabase.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
  if (imovel?.owner_id !== user.id) return { ok: false, erro: "Sem permissão." };
  const { error } = await admin
    .from("imovel_estrutura")
    .upsert({ property_id: propertyId, checklist: v.checklist, atualizado_em: new Date().toISOString() }, { onConflict: "property_id" });
  if (error) {
    console.error("[salvarChecklistEstrutura]", error.code);
    return { ok: false, erro: "Não foi possível salvar agora." };
  }
  revalidatePath(`/imoveis/${propertyId}`);
  revalidatePath("/buscar");
  return { ok: true };
}

/**
 * E225-A: o checklist salvo, para o dono abrir o bloco "estrutura de acessibilidade" no Passo 5 e no editar.
 * Só o dono do anúncio lê por aqui (conferido no servidor); sem linha = {} (nada informado).
 */
export async function lerChecklistEstrutura(propertyId: string): Promise<{ ok: true; checklist: ChecklistEstrutura } | { ok: false; erro: string }> {
  if (!UUID.test(propertyId ?? "")) return { ok: false, erro: "Sem permissão." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, erro: "Não foi possível carregar agora." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const { data: imovel } = await supabase.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
  if (imovel?.owner_id !== user.id) return { ok: false, erro: "Sem permissão." };
  const { data, error } = await admin.from("imovel_estrutura").select("checklist").eq("property_id", propertyId).maybeSingle();
  if (error) {
    console.error("[lerChecklistEstrutura]", error.code);
    return { ok: false, erro: "Não foi possível carregar agora." };
  }
  // O que veio do banco passa pela mesma validação (chave desconhecida fica de fora).
  const v = validarChecklistEstrutura(data?.checklist ?? {});
  return { ok: true, checklist: v.ok ? v.checklist : {} };
}
